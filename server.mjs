import { createServer } from 'node:http';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { demoState, normalize, parseCurriculum, todayInKorea, validDate } from './lib/curriculum.mjs';
import { driveFolder, fileKind, importDrive, importGitHub, inferScope, MAX_FILE_BYTES, remote, RequestError } from './lib/sources.mjs';
import { generateStudy, isStudyModel, listModels, MODEL_DEFAULTS, sampleQuiz } from './lib/study.mjs';

const PUBLIC = fileURLToPath(new URL('./public/', import.meta.url));
const DEFAULT_DATA = fileURLToPath(new URL('./.study-data/', import.meta.url));
const STATIC = {
  '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/styles.css': ['styles.css', 'text/css'],
  '/views.js': ['views.js', 'text/javascript'], '/icons.js': ['icons.js', 'text/javascript'], '/favicon.ico': ['favicon.ico', 'image/x-icon']
};
const INPUT_LIMIT = Math.ceil(MAX_FILE_BYTES * 4 / 3) + 4096;

function json(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
}

async function body(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw new RequestError('JSON 요청이 필요합니다.', 415);
  if (Number(req.headers['content-length']) > INPUT_LIMIT) throw new RequestError('파일당 8MB까지 업로드할 수 있습니다.', 413);
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes <= INPUT_LIMIT) chunks.push(chunk);
  }
  if (bytes > INPUT_LIMIT) throw new RequestError('파일당 8MB까지 업로드할 수 있습니다.', 413);
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new RequestError('요청 내용을 읽을 수 없습니다.');
  }
}

function uploaded(value, limit = MAX_FILE_BYTES) {
  if (typeof value !== 'string' || !value || value.length > Math.ceil(limit / 3) * 4) throw new RequestError('업로드할 파일 또는 파일 크기를 확인해 주세요.');
  const buffer = Buffer.from(value, 'base64');
  if (!buffer.length || buffer.length > limit || buffer.toString('base64') !== value) throw new RequestError('업로드한 파일을 읽을 수 없습니다.');
  return buffer;
}

function validScope(value, includeAuto = false) {
  if (value === '' || value === 'all' || (includeAuto && value === 'auto') || validDate(value)) return value;
  throw new RequestError('자료의 수업 날짜 또는 학습 범위를 확인해 주세요.');
}

function openWorkspace(directory) {
  const file = join(directory, 'workspace.json');
  const materialDirectory = join(directory, 'materials');
  mkdirSync(materialDirectory, { recursive: true });
  const filePath = (id) => join(materialDirectory, id);
  let state = { demo: true, lessons: [], notes: {}, curriculum: null, connections: {}, materials: [], model: MODEL_DEFAULTS[0], quiz: null, summary: null };
  try { state = { ...state, ...JSON.parse(readFileSync(file, 'utf8')) }; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  let version = 0;
  function commit(patch, scopeChanged = false) {
    const next = { ...state, ...patch };
    const temporary = `${file}.tmp`;
    // Commit the replacement before exposing the new state to other requests.
    writeFileSync(temporary, JSON.stringify(next, null, 2), { mode: 0o600 });
    renameSync(temporary, file);
    state = next;
    if (scopeChanged) version++;
  }
  function saveMaterials(files, origin, scope, lessons, config) {
    const materials = [...state.materials];
    const newIds = [];
    const oldIds = [];
    try {
      for (const file of files) {
        const existingIndex = file.externalId ? materials.findIndex((item) => item.externalId === file.externalId) : -1;
        const previous = materials[existingIndex];
        const id = randomUUID();
        newIds.push(id);
        writeFileSync(filePath(id), file.buffer, { mode: 0o600 });
        const material = { id, origin, externalId: file.externalId ?? '', name: file.name, kind: fileKind(file.name), size: file.buffer.length,
          addedAt: new Date().toISOString(), scope: scope === 'auto' ? (previous?.scope || inferScope(file.name, lessons)) : scope };
        if (previous) {
          oldIds.push(previous.id);
          materials[existingIndex] = material;
        } else materials.push(material);
      }
      commit({ demo: false, materials, ...(config ? { connections: { ...state.connections, [origin]: config } } : {}) }, true);
    } catch (error) {
      for (const id of newIds) removeFile(id);
      throw error;
    }
    for (const id of oldIds) removeFile(id);
  }
  function removeFile(id) {
    try { rmSync(filePath(id), { force: true }); } catch { console.error('저장된 자료 파일을 정리하지 못했습니다.'); }
  }
  return { get state() { return state; }, get version() { return version; }, filePath, commit, saveMaterials, removeFile };
}

function quizView(quiz) {
  if (!quiz) return null;
  return { ...quiz, questions: quiz.questions.map(({ answer, explanation, ...question }) => question.attempt ? { ...question, answer, explanation } : question) };
}

function classState(state, today) {
  if (!state.demo) return state;
  const demo = demoState(today);
  return { ...state, lessons: demo.lessons, notes: demo.notes };
}

export function createApp({ directory = DEFAULT_DATA, now = () => new Date() } = {}) {
  const workspace = openWorkspace(directory);
  let apiKey = '';
  let githubToken = '';
  let driveKey = '';
  let availableModels = [];
  let oauth = null;
  let demoQuiz = null;
  let demoSummary = null;
  const pending = new Map();
  const busy = new Set();
  const snapshot = () => {
    const state = classState(workspace.state, todayInKorea(now()));
    return { ...state, quiz: quizView(state.demo ? demoQuiz : state.quiz), summary: state.demo ? demoSummary : state.summary,
      today: todayInKorea(now()), keySet: Boolean(apiKey), githubSignedIn: Boolean(githubToken), driveKeySet: Boolean(driveKey), driveSignedIn: Boolean(oauth),
      drivePendingUrl: oauth?.url ?? '', models: availableModels.length ? availableModels : MODEL_DEFAULTS };
  };

  async function exclusive(operation, action) {
    if (busy.has(operation)) throw new RequestError('이미 처리 중입니다. 잠시 후 다시 시도해 주세요.', 409);
    busy.add(operation);
    try { return await action(); } finally { busy.delete(operation); }
  }

  async function oauthExchange(parameters) {
    const response = await remote('https://oauth2.googleapis.com/token', { method: 'POST', body: new URLSearchParams(parameters) }, 'Google OAuth');
    return response.json();
  }

  async function driveAccessToken() {
    if (!oauth) throw new RequestError('Google 계정으로 먼저 연결해 주세요.');
    if (oauth.expiresAt > Date.now() + 30_000) return oauth.accessToken;
    if (!oauth.refreshToken) { oauth = null; throw new RequestError('Google 계정에 다시 연결해 주세요.'); }
    const current = oauth;
    try {
      const result = await oauthExchange({ client_id: current.clientId, client_secret: current.clientSecret, refresh_token: current.refreshToken, grant_type: 'refresh_token' });
      if (oauth !== current) throw new RequestError('Google 계정 연결이 변경되었습니다. 다시 시도해 주세요.', 409);
      oauth = { ...current, accessToken: result.access_token, expiresAt: Date.now() + Number(result.expires_in) * 1000 };
      return oauth.accessToken;
    } catch (error) {
      if (oauth === current && error.message.includes('(400)')) oauth = null;
      throw error;
    }
  }

  async function mutate(path, input, port) {
    const today = todayInKorea(now());
    const { state } = workspace;
    switch (path) {
      case '/api/curriculum': {
        let lessons;
        try { lessons = parseCurriculum(uploaded(input.data, 2 * 1024 * 1024)); } catch (error) { throw new RequestError(error.message); }
        const completed = new Set(state.lessons.filter((lesson) => lesson.done).map((lesson) => lesson.id));
        const materials = state.materials.map((item) => item.scope ? item : { ...item, scope: inferScope(item.name, lessons) });
        workspace.commit({ demo: false, lessons: lessons.map((lesson) => ({ ...lesson, done: lesson.done || completed.has(lesson.id) })), materials,
          curriculum: { name: basename(normalize(input.name).replace(/\\/g, '/')).slice(0, 180) || 'curriculum.csv', uploadedAt: new Date().toISOString() } }, true);
        return snapshot();
      }
      case '/api/notes': {
        const date = normalize(input.date);
        const note = normalize(input.note);
        if (!validDate(date) || note.length > 12000) throw new RequestError('날짜와 수업 기록을 확인해 주세요.');
        const notes = { ...state.notes };
        if (note) notes[date] = note;
        else delete notes[date];
        workspace.commit({ demo: false, notes }, true);
        return snapshot();
      }
      case '/api/lesson': {
        if (state.demo) throw new RequestError('커리큘럼 CSV를 업로드한 후 수업을 완료 처리할 수 있습니다.');
        if (!state.lessons.some((lesson) => lesson.id === input.id) || typeof input.done !== 'boolean') throw new RequestError('수업을 찾을 수 없습니다.');
        workspace.commit({ lessons: state.lessons.map((lesson) => lesson.id === input.id ? { ...lesson, done: input.done } : lesson) }, true);
        return snapshot();
      }
      case '/api/materials/upload': {
        const name = basename(normalize(input.name).replace(/\\/g, '/'));
        const scope = validScope(input.scope ?? 'auto', true);
        if (!fileKind(name) || name.length > 250) throw new RequestError('텍스트, 코딩 파일, PDF, DOCX, PPTX 또는 XLSX 파일을 선택해 주세요.');
        const data = uploaded(input.data);
        workspace.saveMaterials([{ name, buffer: data }], 'upload', scope, state.lessons);
        return snapshot();
      }
      case '/api/materials/scope': {
        const scope = validScope(input.scope);
        if (!state.materials.some(({ id }) => id === input.id)) throw new RequestError('자료를 찾을 수 없습니다.', 404);
        workspace.commit({ materials: state.materials.map((item) => item.id === input.id ? { ...item, scope } : item) }, true);
        return snapshot();
      }
      case '/api/materials/remove': {
        const item = state.materials.find(({ id }) => id === input.id);
        if (!item) throw new RequestError('자료를 찾을 수 없습니다.', 404);
        workspace.commit({ materials: state.materials.filter(({ id }) => id !== item.id) }, true);
        workspace.removeFile(item.id);
        return snapshot();
      }
      case '/api/settings': {
        const model = normalize(input.model);
        const key = normalize(input.apiKey);
        if (!isStudyModel(model)) throw new RequestError('지원되는 GPT 모델을 선택해 주세요.');
        if (key && !/^sk-[A-Za-z0-9_-]{12,500}$/.test(key)) throw new RequestError('OpenAI API 키 형식을 확인해 주세요.');
        workspace.commit({ model });
        if (input.clearKey) { apiKey = ''; availableModels = []; }
        else if (key !== '' && key !== apiKey) { apiKey = key; availableModels = []; }
        return snapshot();
      }
      case '/api/models':
        return exclusive('models', async () => {
          const key = normalize(input.apiKey) || apiKey;
          if (!/^sk-[A-Za-z0-9_-]{12,500}$/.test(key)) throw new RequestError('OpenAI API 키를 먼저 입력해 주세요.');
          const models = await listModels(key);
          if (!models.length) throw new RequestError('이 키에서 학습용 GPT 모델을 찾지 못했습니다.');
          if (key === apiKey) availableModels = models;
          return { models };
        });
      case '/api/github':
      case '/api/drive': {
        const origin = path === '/api/github' ? 'github' : 'drive';
        const scope = validScope(input.scope ?? 'auto', true);
        return exclusive(origin, async () => {
          const token = normalize(input.token) || githubToken;
          const googleKey = normalize(input.apiKey) || driveKey;
          const result = origin === 'github' ? await importGitHub({ ...input, token }) : await importDrive({ ...input,
            apiKey: input.mode === 'oauth' ? '' : googleKey, accessToken: input.mode === 'oauth' ? await driveAccessToken() : '' });
          if (!result.files.length) throw new RequestError('선택한 위치에서 지원되는 학습 파일을 찾지 못했습니다.');
          workspace.saveMaterials(result.files, origin, scope, workspace.state.lessons, result.config);
          if (origin === 'github') githubToken = token;
          else if (input.mode !== 'oauth') driveKey = googleKey;
          return { state: snapshot(), imported: result.files.length, failed: result.failed, limited: result.limited };
        });
      }
      case '/api/drive/authorize': {
        const clientId = normalize(input.clientId);
        const clientSecret = normalize(input.clientSecret);
        if (!/^[\w.-]+\.apps\.googleusercontent\.com$/.test(clientId) || !/^[\w-]{8,200}$/.test(clientSecret)) {
          throw new RequestError('Google Cloud의 데스크톱 앱 OAuth 클라이언트 ID와 보안 비밀번호를 확인해 주세요.');
        }
        const folder = driveFolder(input.url);
        const scope = validScope(input.scope ?? 'auto', true);
        const stateToken = randomBytes(32).toString('base64url');
        const verifier = randomBytes(48).toString('base64url');
        const redirect = `http://127.0.0.1:${port}/api/drive/callback`;
        // Bind the callback to this one folder request and to a one-time PKCE verifier.
        pending.clear();
        pending.set(stateToken, { clientId, clientSecret, verifier, redirect, scope, expiresAt: Date.now() + 600_000,
          url: `https://drive.google.com/drive/folders/${folder.id}${folder.resourceKey ? `?resourcekey=${folder.resourceKey}` : ''}` });
        const authorize = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authorize.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirect, response_type: 'code', scope: 'https://www.googleapis.com/auth/drive.readonly',
          code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', state: stateToken, access_type: 'offline', prompt: 'consent' });
        return { url: authorize.href };
      }
      case '/api/study': {
        if (!apiKey) throw new RequestError('자료 구성에서 OpenAI API 키를 먼저 저장해 주세요.');
        const version = workspace.version;
        return exclusive('study', async () => {
          const generated = await generateStudy({ state: classState(state, today), input, key: apiKey, model: state.model, today, filePath: workspace.filePath });
          // Avoid saving results against a study scope edited while the API call was in flight.
          if (version !== workspace.version) throw new RequestError('생성 중에 수업 기록이나 자료가 바뀌었습니다. 최신 학습 범위로 다시 생성해 주세요.', 409);
          const field = input.mode === 'summary' ? 'summary' : 'quiz';
          if (!state.demo) workspace.commit({ [field]: generated });
          else if (field === 'quiz') demoQuiz = generated;
          else demoSummary = generated;
          return { state: snapshot(), [field]: field === 'quiz' ? quizView(generated) : generated };
        });
      }
      case '/api/answer': {
        const quiz = state.demo ? demoQuiz : state.quiz;
        const response = normalize(input.answer);
        const question = quiz?.questions.find((item) => item.id === input.id);
        if (!quiz || quiz.id !== input.quizId || !question) throw new RequestError('문제 세트를 다시 열어 주세요.', 404);
        if (!response || response === question.starter?.trim() || response.length > 15000) throw new RequestError('답안을 작성한 뒤 제출해 주세요.');
        const questions = quiz.questions.map((item) => item.id === input.id ? { ...item, attempt: { text: response, submittedAt: new Date().toISOString() } } : item);
        const answered = { ...quiz, questions };
        if (state.demo) demoQuiz = answered;
        else workspace.commit({ quiz: answered });
        return quizView(answered);
      }
      case '/api/sample':
        if (!state.demo) throw new RequestError('커리큘럼으로 문제를 생성해 주세요.');
        demoQuiz = sampleQuiz();
        return quizView(demoQuiz);
      default:
        throw new RequestError('요청한 기능을 찾을 수 없습니다.', 404);
    }
  }

  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    const port = req.socket.localPort;
    const origins = [`http://127.0.0.1:${port}`, `http://localhost:${port}`];
    try {
      const origin = `http://${req.headers.host}`;
      if (!origins.includes(origin) || req.headers['sec-fetch-site'] === 'cross-site' && req.method !== 'GET') throw new RequestError('이 앱은 로컬 주소에서만 사용할 수 있습니다.', 403);
      const url = new URL(req.url, origin);
      if (req.method === 'GET' && url.pathname === '/api/drive/callback') {
        const stateToken = url.searchParams.get('state');
        const authorization = pending.get(stateToken);
        pending.delete(stateToken);
        const go = (status) => { res.writeHead(303, { Location: `/#materials?drive=${status}` }); res.end(); };
        if (!authorization || authorization.expiresAt < Date.now() || !url.searchParams.get('code')) return go('cancelled');
        try {
          const { clientId, clientSecret, redirect, verifier, scope, url: folderUrl } = authorization;
          const result = await oauthExchange({ client_id: clientId, client_secret: clientSecret, redirect_uri: redirect,
            code_verifier: verifier, code: url.searchParams.get('code'), grant_type: 'authorization_code' });
          if (!result.access_token) return go('error');
          oauth = { clientId, clientSecret, accessToken: result.access_token, refreshToken: result.refresh_token, expiresAt: Date.now() + Number(result.expires_in) * 1000, url: folderUrl };
          await mutate('/api/drive', { url: folderUrl, scope, mode: 'oauth' }, port);
          return go('connected');
        } catch { return go(oauth ? 'import-failed' : 'error'); }
      }
      if (req.method === 'GET' && url.pathname === '/api/health') return json(res, 200, { app: 'bootcamp-studying-tool' });
      if (req.method === 'GET' && url.pathname === '/api/state') return json(res, 200, snapshot());
      if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
        if (req.headers.origin !== origin) throw new RequestError('앱 화면에서 요청을 다시 실행해 주세요.', 403);
        return json(res, 200, await mutate(url.pathname, await body(req), port));
      }
      if ((req.method === 'GET' || req.method === 'HEAD') && Object.hasOwn(STATIC, url.pathname)) {
        if (url.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
        const [file, mime] = STATIC[url.pathname];
        const data = await readFile(join(PUBLIC, file));
        res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8` });
        return res.end(req.method === 'HEAD' ? undefined : data);
      }
      throw new RequestError('페이지를 찾을 수 없습니다.', 404);
    } catch (error) {
      if (!(error instanceof RequestError)) console.error('로컬 처리 오류:', error.name, error.code ?? '');
      if (!res.headersSent) json(res, error.status ?? 500, { error: error instanceof RequestError ? error.message : '로컬 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 4173);
  createApp().listen(port, '127.0.0.1', () => console.log(`Bootcamp Studying Tool · http://127.0.0.1:${port}`));
}
