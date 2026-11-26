import { icon } from './icons.js';
import { esc, noteDialog, removeDialog, routes, scopeDialog, view } from './views.js';

const root = document.querySelector('#app');
const toast = document.querySelector('#toast');
const dialog = document.querySelector('#dialog');
const ui = { menu: false, week: 0, lessonFilter: 'all', openLessonNotes: new Set(), reviewTab: 'quiz', quizKind: 'mixed', count: 5,
  studyDate: '', question: '', drafts: {}, models: [], driveMode: '', driveScope: 'auto' };
let state;
let toastTimer;
let lastRoute;
let returnFocus;

function routeInfo() {
  const [path, search] = location.hash.slice(1).split('?');
  return { route: Object.hasOwn(routes, path) ? path : 'home', query: new URLSearchParams(search) };
}

function render() {
  const { route } = routeInfo();
  if (route === 'lessons') {
    for (const disclosure of root.querySelectorAll('[data-note-date]')) {
      const { noteDate } = disclosure.dataset;
      if (disclosure.open && state.notes[noteDate]) ui.openLessonNotes.add(noteDate);
      else ui.openLessonNotes.delete(noteDate);
    }
  } else ui.openLessonNotes.clear();
  root.innerHTML = view(state, route, ui);
  document.title = `${routes[route].title} · Bootcamp Studying Tool`;
  lastRoute = route;
}

function announce(message, error = false) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.className = `toast ${error ? 'toast--error' : 'toast--success'}`;
  toast.setAttribute('role', error ? 'alert' : 'status');
  toast.hidden = false;
  toastTimer = setTimeout(() => { toast.hidden = true; }, error ? 9500 : 5000);
}

async function api(path, input) {
  let result;
  try {
    const response = await fetch(`/api/${path}`, input === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input)
    });
    result = await response.json();
    if (!response.ok) throw new Error(result.error || '요청을 처리하지 못했습니다.');
  } catch (error) {
    if (error instanceof TypeError) throw new Error('로컬 앱 서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해 주세요.');
    throw error;
  }
  return result;
}

async function waiting(control, text, task) {
  if (control?.disabled) return;
  const contents = control?.innerHTML;
  if (control) {
    control.form?.querySelector('.form-error')?.remove();
    control.disabled = true;
    control.setAttribute('aria-busy', 'true');
    control.innerHTML = `<i class="spinner"></i><span>${text}</span>`;
  }
  try { await task(); } catch (error) {
    if (control?.form?.closest('dialog')) {
      const alert = Object.assign(document.createElement('p'), { className: 'form-error', textContent: error.message });
      alert.setAttribute('role', 'alert');
      control.closest('.dialog-actions')?.before(alert);
    } else announce(error.message, true);
  }
  finally {
    if (control?.isConnected) {
      control.disabled = false;
      control.removeAttribute('aria-busy');
      control.innerHTML = contents;
    }
  }
}

function update(snapshot) {
  state = snapshot;
  if (ui.studyDate && !state.lessons.some(({ date }) => date === ui.studyDate) && !state.notes[ui.studyDate]) ui.studyDate = '';
  render();
}

function modal(html, trigger) {
  returnFocus = trigger;
  dialog.innerHTML = html;
  dialog.showModal();
  dialog.querySelector('textarea, input[type=date]:not([hidden] *), select, button')?.focus();
}

function restore(action, { id, date, filter, tab, direction } = {}) {
  const elements = [...root.querySelectorAll(`[data-action="${action}"]`)];
  const next = elements.find((item) => (!id || item.dataset.id === id) && (!date || item.dataset.date === date) &&
    (!filter || item.dataset.filter === filter) && (!tab || item.dataset.tab === tab) && (!direction || item.dataset.direction === direction));
  next?.focus({ preventScroll: true });
}

dialog.addEventListener('close', () => {
  if (returnFocus?.isConnected) returnFocus.focus();
  else if (returnFocus?.dataset.action) restore(returnFocus.dataset.action, returnFocus.dataset);
  returnFocus = null;
});

function onRoute() {
  if (!state) return;
  const { route, query } = routeInfo();
  const changed = lastRoute !== route;
  ui.menu = false;
  render();
  if (changed) {
    window.scrollTo(0, 0);
    document.querySelector('#main').focus({ preventScroll: true });
  }
  if (query.has('drive')) {
    const notifications = {
      connected: 'Google 계정에 연결하고 Drive 자료를 가져왔습니다.',
      cancelled: 'Google 계정 연결이 취소되었거나 만료되었습니다.',
      'import-failed': 'Google 계정에 연결했습니다. Drive 폴더 주소와 읽기 권한을 확인해 다시 가져와 주세요.',
      error: 'Google 로그인에 실패했습니다. OAuth 클라이언트 설정을 확인해 주세요.'
    };
    ui.driveMode = 'oauth';
    render();
    const result = query.get('drive');
    if (notifications[result]) announce(notifications[result], result !== 'connected');
    history.replaceState(null, '', '#materials');
  }
}

function fileData(file, limit) {
  if (!file?.size || file.size > limit) throw new Error(`비어 있지 않은 ${limit / 1024 / 1024}MB 이하의 파일을 선택해 주세요.`);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(',') + 1));
    reader.onerror = () => reject(new Error('선택한 파일을 읽을 수 없습니다.'));
    reader.readAsDataURL(file);
  });
}

function download(name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const anchor = Object.assign(document.createElement('a'), { href: url, download: name });
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadSummary() {
  const summary = state.summary;
  const sections = summary.sections.flatMap((section) => [
    `## ${section.title}`, '', section.explanation, '', ...section.takeaways.map((point) => `- ${point}`), '',
    ...(section.sources.length ? [`참고자료 · ${section.sources.map((id) => summary.sources[id]).join(', ')}`, ''] : [])
  ]);
  const checklist = summary.checklist.length ? ['## 복습 체크리스트', '', ...summary.checklist.map((point) => `- [ ] ${point}`)] : [];
  download('bootcamp-study-summary.md', [`# ${summary.title}`, '', summary.overview, '', ...sections, ...checklist, ''].join('\n'), 'text/markdown;charset=utf-8');
}

function makeTemplate() {
  const rows = ['날짜,주제,단원,완료', `${state.today},변수와 자료형,JavaScript,완료`, `${state.today},배열 메서드 실습,JavaScript,`];
  download('bootcamp-curriculum.csv', `\uFEFF${rows.join('\r\n')}\r\n`, 'text/csv;charset=utf-8');
}

async function runAction(event) {
  const control = event.target.closest('button[data-action]');
  if (!control || !state) return;
  const { action, date, id, direction, filter, tab } = control.dataset;
  switch (action) {
    case 'menu': ui.menu = !ui.menu; render(); break;
    case 'week': ui.week += Number(direction); render(); restore(action, { direction }); break;
    case 'lesson-filter': ui.lessonFilter = filter; render(); restore(action, { filter }); break;
    case 'review-tab': ui.reviewTab = tab; render(); restore(action, { tab }); break;
    case 'question': ui.question = id; render(); restore(action, { id }); break;
    case 'note': modal(noteDialog(state, date), control); break;
    case 'edit-scope': modal(scopeDialog(state.materials.find((item) => item.id === id)), control); break;
    case 'remove-material': modal(removeDialog(state.materials.find((item) => item.id === id)), control); break;
    case 'close-dialog': dialog.close(); break;
    case 'template': makeTemplate(); break;
    case 'download-summary': downloadSummary(); break;
    case 'sample':
      await waiting(control, '불러오는 중', async () => {
        state.quiz = await api('sample', {});
        ui.question = '';
        ui.drafts = {};
        render();
      });
      break;
    case 'models':
      await waiting(control, '모델 확인 중', async () => {
        const form = control.form;
        const picker = form.elements.model;
        const previous = picker.value;
        const { models } = await api('models', { apiKey: form.elements.apiKey.value });
        ui.models = models;
        picker.replaceChildren(...models.map((model) => new Option(model, model, false, model === previous)));
        announce(`사용할 수 있는 모델 ${models.length}개를 확인했습니다.`);
      });
      break;
    case 'clear-key':
      await waiting(control, '지우는 중', async () => {
        ui.models = [];
        update(await api('settings', { model: state.model, clearKey: true }));
        announce('OpenAI API 키를 지웠습니다.');
      });
      break;
  }
}

async function runSubmit(event) {
  const form = event.target.closest('[data-form]');
  if (!form || !state) return;
  event.preventDefault();
  const input = Object.fromEntries(new FormData(form));
  if (input.scope === 'date') input.scope = input.scopeDate;
  delete input.scopeDate;
  const kind = form.dataset.form;
  const labels = { curriculum: '업로드 중', upload: '업로드 중', github: '가져오는 중', drive: '연결 중', study: '생성 중', remove: '삭제 중' };
  await waiting(event.submitter ?? form.querySelector('[type=submit]'), labels[kind] ?? '저장 중', async () => {
    switch (kind) {
      case 'curriculum': {
        const result = await api('curriculum', { name: input.file.name, data: await fileData(input.file, 2 * 1024 * 1024) });
        ui.lessonFilter = 'all';
        ui.week = 0;
        update(result);
        announce(`수업 일정 ${result.lessons.length}개를 가져왔습니다.`);
        break;
      }
      case 'note': {
        const result = await api('notes', input);
        dialog.close();
        update(result);
        announce(input.note.trim() ? '수업 기록을 저장했습니다.' : '빈 수업 기록을 지웠습니다.');
        break;
      }
      case 'settings': {
        const result = await api('settings', input);
        if (input.apiKey) form.elements.apiKey.value = '';
        update(result);
        announce('OpenAI 설정을 저장했습니다.');
        break;
      }
      case 'github':
      case 'drive': {
        if (kind === 'drive' && input.mode === 'oauth' && !state.driveSignedIn) {
          const { url } = await api('drive/authorize', input);
          location.assign(url);
          return;
        }
        const result = await api(kind, input);
        update(result.state);
        announce(`자료 ${result.imported}개를 가져왔습니다.${result.failed ? ` 읽지 못한 파일 ${result.failed}개.` : ''}${result.limited ? ' 더 가져오려면 작은 하위 폴더를 선택하세요.' : ''}`);
        break;
      }
      case 'upload': {
        const files = [...form.elements.files.files];
        const failures = [];
        let result;
        let uploaded = 0;
        for (const file of files) {
          try {
            result = await api('materials/upload', { name: file.name, data: await fileData(file, 8 * 1024 * 1024), scope: input.scope });
            uploaded++;
          } catch (error) { failures.push(`${file.name} · ${error.message}`); }
        }
        if (result) update(result);
        if (failures.length) announce(`${uploaded ? `자료 ${uploaded}개 저장. ` : ''}${failures[0]}${failures.length > 1 ? ` (실패 ${failures.length}개)` : ''}`, true);
        else announce(`자료 ${uploaded}개를 저장했습니다.`);
        break;
      }
      case 'scope':
      case 'remove': {
        const result = await api(`materials/${kind}`, { id: form.dataset.id, scope: input.scope });
        dialog.close();
        update(result);
        announce(kind === 'scope' ? '자료 학습 범위를 저장했습니다.' : '자료를 삭제했습니다.');
        break;
      }
      case 'study': {
        const mode = ui.reviewTab;
        if (mode === 'quiz') { ui.count = Number(input.count); ui.quizKind = input.kind; }
        ui.studyDate = input.date;
        const result = await api('study', { ...input, mode });
        if (mode === 'quiz') { ui.question = ''; ui.drafts = {}; }
        update({ ...result.state, [mode]: result[mode] });
        announce(mode === 'quiz' ? `복습 문제 ${result.quiz.questions.length}개를 만들었습니다.` : '학습 요약을 만들었습니다.');
        break;
      }
      case 'answer': {
        const quiz = await api('answer', { quizId: form.dataset.quiz, id: form.dataset.id, answer: input.answer });
        state.quiz = quiz;
        delete ui.drafts[form.dataset.id];
        render();
        const answer = root.querySelector('.answer');
        if (answer) { answer.tabIndex = -1; answer.focus({ preventScroll: true }); answer.scrollIntoView({ block: 'nearest' }); }
        announce('답안을 저장했습니다. 모범 답안과 풀이를 확인하세요.');
        break;
      }
    }
  });
}

async function runChange(event) {
  const target = event.target;
  const form = target.form;
  if (target.matches('input[type=file]')) {
    const label = target.closest('.drop')?.querySelector('[data-file-label]');
    if (label && target.files.length) label.textContent = target.files.length === 1 ? target.files[0].name : `파일 ${target.files.length}개 선택`;
  }
  if (target.matches('[data-scope]')) {
    const picker = form.elements.scopeDate;
    picker.closest('label').hidden = target.value !== 'date';
    picker.required = target.value === 'date';
    if (!picker.value) picker.value = state.today;
    if (target.dataset.scope === 'drive') ui.driveScope = target.value;
  }
  if (target.dataset.action === 'drive-mode') {
    ui.driveMode = target.value;
    ui.driveUrl = form.elements.url.value;
    render();
    root.querySelector('[data-action=drive-mode]').focus({ preventScroll: true });
  }
  if (form?.dataset.form === 'drive' && target.name === 'scopeDate') ui.driveScopeDate = target.value;
  if (form?.dataset.form === 'note' && target.name === 'date') form.elements.note.value = state.demo ? '' : state.notes[target.value] ?? '';
  if (form?.dataset.form === 'study' && target.name === 'date') ui.studyDate = target.value;
  if (form?.dataset.form === 'study' && target.name === 'kind') ui.quizKind = target.value;
  if (target.dataset.action === 'lesson') {
    const done = target.checked;
    target.disabled = true;
    try {
      update(await api('lesson', { id: target.dataset.id, done }));
      restore('lesson', { id: target.dataset.id });
      announce(done ? '수업을 완료로 표시했습니다.' : '수업 완료를 해제했습니다.');
    } catch (error) {
      target.checked = !done;
      announce(error.message, true);
    } finally { target.disabled = false; }
  }
}

document.addEventListener('click', runAction);
document.addEventListener('submit', runSubmit);
document.addEventListener('change', runChange);
document.addEventListener('input', ({ target }) => {
  if (target.matches('[data-form=answer] textarea')) ui.drafts[target.form.dataset.id] = target.value;
  if (target.matches('[data-form=study] input[name=count]')) ui.count = target.value;
  if (target.matches('[data-form=drive] input[name=url]')) ui.driveUrl = target.value;
});
document.querySelector('.skip').addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelector('#main')?.focus();
});
window.addEventListener('hashchange', onRoute);

try {
  state = await api('state');
  onRoute();
} catch (error) {
  root.innerHTML = `<div class="loading-screen"><h1>${icon('info')} 학습 공간을 열 수 없습니다</h1><p>${esc(error.message)}</p><a class="button button--primary" href="/">새로고침</a></div>`;
}
