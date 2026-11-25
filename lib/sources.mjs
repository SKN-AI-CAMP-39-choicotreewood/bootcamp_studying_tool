import { extname } from 'node:path';
import { normalize, validDate } from './curriculum.mjs';

export const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_REMOTE_FILES = 24;
const TEXT_FILE = /\.(txt|md|markdown|mdx|rst|csv|tsv|json|jsonl|xml|html?|css|scss|less|ipynb|py|js|jsx|ts|tsx|mjs|cjs|vue|svelte|java|kt|kts|go|rs|c|cpp|h|hpp|cs|rb|php|sql|sh|ps1|r|swift|dart|scala|ya?ml|toml|ini|gradle)$/i;
const ATTACHMENT = /\.(pdf|docx|pptx|xlsx)$/i;
const IGNORED = /(?:^|\/)(?:\.[^/]*|node_modules|vendor|dist|build|__pycache__|coverage)(?:\/|$)|(?:^|\/)(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|.*\.min\.js|.*\.map|poetry\.lock)$/i;

export const fileKind = (name) => TEXT_FILE.test(name) || /(?:^|\/)(?:README|Dockerfile|Makefile)$/i.test(name) ? 'text' : ATTACHMENT.test(name) ? 'attachment' : '';
export const attachmentMime = (name) => ({
  '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
})[extname(name).toLowerCase()];

export class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export async function remote(url, options, provider) {
  let response;
  try {
    response = await fetch(url, { ...options, signal: AbortSignal.timeout(provider === 'OpenAI' ? 240_000 : 25_000) });
  } catch {
    throw new RequestError(`${provider}에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.`, 502);
  }
  if (response.ok) return response;
  await response.body?.cancel();
  const messages = {
    400: '요청 형식, 모델 지원 여부 또는 연결 설정을 확인해 주세요.',
    401: '키 또는 로그인 상태를 확인해 주세요.',
    402: '결제 및 API 사용 한도를 확인해 주세요.',
    403: '읽기 권한이나 API 사용 한도를 확인해 주세요.',
    404: '주소, 모델 또는 접근 권한을 확인해 주세요.',
    429: 'API 사용 한도 또는 요청 빈도를 확인해 주세요.'
  };
  throw new RequestError(`${provider} (${response.status}) · ${messages[response.status] ?? '잠시 후 다시 시도해 주세요.'}`, 502);
}

async function readFileResponse(response) {
  if (Number(response.headers.get('content-length')) > MAX_FILE_BYTES) {
    await response.body?.cancel();
    throw new Error('large file');
  }
  const chunks = [];
  let bytes = 0;
  for await (const chunk of response.body) {
    bytes += chunk.length;
    if (bytes > MAX_FILE_BYTES) throw new Error('large file');
    chunks.push(chunk);
  }
  if (!bytes) throw new Error('empty file');
  return Buffer.concat(chunks, bytes);
}

async function collectFiles(candidates, load, hasMore) {
  const files = [];
  let failed = 0;
  const selected = candidates.slice(0, MAX_REMOTE_FILES);
  for (let index = 0; index < selected.length; index += 4) {
    const batch = await Promise.allSettled(selected.slice(index, index + 4).map(async (file) => ({ ...file, buffer: await load(file) })));
    for (const result of batch) {
      if (result.status === 'fulfilled') files.push(result.value);
      else failed++;
    }
  }
  if (selected.length && !files.length) throw new RequestError('지원 파일을 읽지 못했습니다. 파일 권한과 API 호출 한도를 확인해 주세요.', 502);
  return { files, failed, limited: hasMore || candidates.length > selected.length };
}

export function githubRepository(value) {
  const address = normalize(value);
  const parts = address.match(/^(?:https:\/\/github\.com\/)?([\w.-]+)\/([\w.-]+?)\/?$/i);
  if (!parts || parts.slice(1).some((part) => /^\.{1,2}$/.test(part))) {
    throw new RequestError('GitHub 저장소 주소를 입력해 주세요. 브랜치와 하위 폴더는 별도 항목에 입력할 수 있습니다.');
  }
  const owner = parts[1];
  const repo = parts[2].replace(/\.git$/i, '');
  if (!repo || /^\.{1,2}$/.test(repo)) throw new RequestError('GitHub 저장소 이름을 확인해 주세요.');
  return { owner, repo };
}

export async function importGitHub(options) {
  const { owner, repo } = githubRepository(options.url);
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'Bootcamp-Studying-Tool' };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  const metadata = await (await remote(base, { headers }, 'GitHub')).json();
  const branch = normalize(options.branch) || metadata.default_branch;
  const folder = normalize(options.folder).replace(/^\/+|\/+$/g, '');
  const tree = await (await remote(`${base}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers }, 'GitHub')).json();
  const candidates = (tree.tree ?? []).filter((file) => file.type === 'blob' && file.mode !== '120000' &&
    file.size > 0 && file.size <= MAX_FILE_BYTES && (!folder || file.path.startsWith(`${folder}/`)) && !IGNORED.test(file.path) && fileKind(file.path))
    .sort((a, b) => priority(b.path) - priority(a.path) || a.path.localeCompare(b.path))
    .map((file) => ({ name: file.path, externalId: `github:${owner.toLowerCase()}/${repo.toLowerCase()}:${branch}:${file.path}`, sha: file.sha }));
  const results = await collectFiles(candidates, async (file) => {
    if (!/^[a-f0-9]{40,64}$/.test(file.sha)) throw new Error('invalid blob');
    const reply = await remote(`${base}/git/blobs/${file.sha}`, { headers: { ...headers, Accept: 'application/vnd.github.raw+json' } }, 'GitHub');
    if (!reply.headers.get('content-type')?.includes('application/json')) return readFileResponse(reply);
    // GitHub can return the JSON blob representation for raw media requests.
    const payload = await reply.text();
    let blob;
    try { blob = JSON.parse(payload); } catch { return Buffer.from(payload); }
    if (blob?.encoding === 'base64' && blob.sha === file.sha && typeof blob.content === 'string') return Buffer.from(blob.content, 'base64');
    return Buffer.from(payload);
  }, tree.truncated);
  return { ...results, config: { url: `https://github.com/${owner}/${repo}`, branch, folder } };
}

function priority(path) {
  if (/(?:^|\/)(?:readme[^/]*|.*\.(?:md|ipynb))$/i.test(path)) return 2;
  if (/exercise|practice|lesson|lecture|실습|강의/i.test(path)) return 1;
  return 0;
}

const GOOGLE_FOLDER = 'application/vnd.google-apps.folder';
const EXPORTS = {
  'application/vnd.google-apps.document': { mime: 'text/plain', extension: '.txt' },
  'application/vnd.google-apps.spreadsheet': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: '.xlsx' },
  'application/vnd.google-apps.presentation': { mime: 'application/pdf', extension: '.pdf' }
};

export function driveFolder(value) {
  const address = normalize(value);
  let id = address;
  let resourceKey = '';
  if (address.startsWith('https://')) {
    let url;
    try { url = new URL(address); } catch { throw new RequestError('Google Drive 폴더 주소를 확인해 주세요.'); }
    if (url.hostname !== 'drive.google.com') throw new RequestError('Google Drive 폴더 주소를 확인해 주세요.');
    id = url.pathname.match(/\/folders\/([\w-]+)/)?.[1] ?? (url.pathname === '/open' ? url.searchParams.get('id') : '') ?? '';
    resourceKey = url.searchParams.get('resourcekey') ?? '';
  }
  if (!/^[\w-]{8,200}$/.test(id) || (resourceKey && !/^[\w-]{1,200}$/.test(resourceKey))) {
    throw new RequestError('Google Drive 폴더 URL 또는 폴더 ID를 입력해 주세요.');
  }
  return { id, resourceKey };
}

export async function importDrive(options) {
  const root = driveFolder(options.url);
  const { apiKey, accessToken } = options;
  if (!apiKey && !accessToken) throw new RequestError('공유 폴더용 Google API 키를 입력하거나 Google 계정에 연결해 주세요.');
  const base = 'https://www.googleapis.com/drive/v3/files';
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : { 'X-Goog-Api-Key': apiKey };
  const request = (url, keys) => remote(url, { headers: { ...headers, ...(keys.length ? { 'X-Goog-Drive-Resource-Keys': keys.join(',') } : {}) } }, 'Google Drive');
  const rootKeys = root.resourceKey ? [`${root.id}/${root.resourceKey}`] : [];
  const rootFile = new URL(`${base}/${root.id}`);
  rootFile.search = new URLSearchParams({ fields: 'id,name,mimeType', supportsAllDrives: 'true' });
  const metadata = await (await request(rootFile, rootKeys)).json();
  if (metadata.mimeType !== GOOGLE_FOLDER) throw new RequestError('파일 대신 Google Drive 폴더 주소를 입력해 주세요.');
  const folders = [{ id: root.id, prefix: '', keys: rootKeys }];
  const candidates = [];
  let pages = 0;
  let limited = false;
  while (folders.length && candidates.length <= MAX_REMOTE_FILES && pages < 20) {
    const folder = folders.shift();
    const url = new URL(base);
    url.search = new URLSearchParams({ q: `'${folder.id}' in parents and trashed = false`, fields: 'nextPageToken,incompleteSearch,files(id,name,mimeType,size,resourceKey,capabilities(canDownload))',
      pageSize: '100', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true', orderBy: 'name_natural' });
    if (folder.pageToken) url.searchParams.set('pageToken', folder.pageToken);
    const page = await (await request(url, folder.keys)).json();
    pages++;
    limited ||= Boolean(page.incompleteSearch);
    if (page.nextPageToken) folders.unshift({ ...folder, pageToken: page.nextPageToken });
    for (const file of page.files ?? []) {
      const path = `${folder.prefix}${file.name}`;
      const keys = file.resourceKey ? [...folder.keys, `${file.id}/${file.resourceKey}`] : folder.keys;
      if (file.mimeType === GOOGLE_FOLDER) {
        folders.push({ id: file.id, prefix: `${path}/`, keys });
        continue;
      }
      const exportType = EXPORTS[file.mimeType];
      const name = `${path}${exportType?.extension ?? ''}`;
      if (!fileKind(name) || Number(file.size) > MAX_FILE_BYTES || file.capabilities?.canDownload === false) continue;
      candidates.push({ name, id: file.id, externalId: `drive:${file.id}`, mime: exportType?.mime, keys });
    }
  }
  const results = await collectFiles(candidates, (file) => {
    const query = file.mime ? `export?mimeType=${encodeURIComponent(file.mime)}` : '?alt=media&supportsAllDrives=true';
    const url = `${base}/${encodeURIComponent(file.id)}${file.mime ? '/' : ''}${query}`;
    return request(url, file.keys).then(readFileResponse);
  }, limited || Boolean(folders.length));
  return { ...results, config: { url: `https://drive.google.com/drive/folders/${root.id}${root.resourceKey ? `?resourcekey=${root.resourceKey}` : ''}`, name: metadata.name, mode: accessToken ? 'oauth' : 'public' } };
}

export function inferScope(name, lessons) {
  const match = name.match(/(?:^|[^\d])(20\d{2})[-_. ]?(\d{2})[-_. ]?(\d{2})(?!\d)/);
  if (match) {
    const date = `${match[1]}-${match[2]}-${match[3]}`;
    if (validDate(date)) return date;
  }
  const compact = (value) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const filename = compact(name);
  const dates = new Set(lessons.filter(({ title }) => compact(title).length >= 4 && filename.includes(compact(title))).map(({ date }) => date));
  return dates.size === 1 ? [...dates][0] : '';
}
