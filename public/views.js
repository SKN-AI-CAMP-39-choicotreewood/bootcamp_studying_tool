import { icon } from './icons.js';

export const routes = {
  home: { name: '홈', title: '학습 대시보드', icon: 'home', description: '부트캠프 진도와 최근 수업 기록을 한눈에 확인하세요.' },
  lessons: { name: '수업 진행상황', title: '수업 진행상황', icon: 'calendar', description: '커리큘럼을 따라 수업을 완료하고 날짜별로 배운 내용을 남기세요.' },
  materials: { name: '자료 구성', title: '자료 구성', icon: 'folder', description: '커리큘럼과 실습 파일을 모으고, 복습에 사용할 GPT 모델을 설정하세요.' },
  review: { name: '복습 문제 풀이', title: '복습 문제 풀이', icon: 'spark', description: '수업에서 배운 내용을 문제로 풀어보고, 핵심 개념을 요약하세요.' }
};

const KEYS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, (char) => KEYS[char]);
const dateObject = (value) => new Date(`${value}T12:00:00Z`);
const format = (value, options) => new Intl.DateTimeFormat('ko-KR', { ...options, timeZone: 'UTC' }).format(dateObject(value));
export const dateLabel = (value) => format(value, { month: 'long', day: 'numeric', weekday: 'long' });
const compactDate = (value) => value.slice(5).replace('-', '.');
const days = ['일', '월', '화', '수', '목', '금', '토'];
const percent = (part, all) => all ? Math.round(part / all * 100) : 0;
export const selected = (a, b) => a === b ? ' selected' : '';
const button = (text, symbol, attributes = '', style = 'primary') => `<button class="button button--${style}" ${attributes}>${symbol ? icon(symbol, 18) : ''}<span>${text}</span></button>`;
const link = (text, symbol, target, style = 'secondary') => `<a class="button button--${style}" href="#${target}">${symbol ? icon(symbol, 18) : ''}<span>${text}</span></a>`;
const tile = (name, color = 'green') => `<span class="icon-tile icon-tile--${color}">${icon(name, 20)}</span>`;
const tag = (text, type = 'neutral') => `<span class="tag tag--${type}">${text}</span>`;
const textLink = (text, target) => `<a class="text-link" href="#${target}">${text}</a>`;
const meter = (value, color = 'green', label = '진행률') => `<div class="meter meter--${color}" role="progressbar" aria-label="${esc(label)}" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100"><span style="--fill:${value}%"></span></div>`;
const blank = (symbol, title, text, action = '') => `<div class="blank">${tile(symbol)}<strong>${title}</strong><p>${text}</p>${action}</div>`;
const heading = (symbol, title, description, color = 'green') => `<header class="card-heading">${tile(symbol, color)}<div><h2>${title}</h2><p>${description}</p></div></header>`;

export function offsetDate(date, amount) {
  const day = dateObject(date);
  day.setUTCDate(day.getUTCDate() + amount);
  return day.toISOString().slice(0, 10);
}

function progress(state) {
  const allDays = [...new Set(state.lessons.map(({ date }) => date))];
  const elapsed = allDays.filter((day) => day <= state.today).length;
  const completed = state.lessons.filter(({ done }) => done).length;
  return {
    days: allDays.length, elapsed, completed, classes: state.lessons.length, notes: Object.keys(state.notes).length,
    elapsedPercent: percent(elapsed, allDays.length), completedPercent: percent(completed, state.lessons.length)
  };
}

function pageHeading(route, action = '') {
  const page = routes[route];
  return `<header class="page-heading"><div><h1>${page.title}</h1><p>${page.description}</p></div>${action}</header>`;
}

function shell(state, route, content, ui) {
  const p = progress(state);
  return `<div class="layout ${ui.menu ? 'menu-open' : ''}">
    <aside class="sidebar" id="workspace-menu">
      <a class="brand" href="#home" aria-label="Bootcamp Studying Tool 홈"><span class="brand-icon">${icon('logo', 26)}</span><span><strong>Bootcamp</strong><small>Studying Tool</small></span></a>
      <nav aria-label="학습 메뉴" class="navigation"><p>워크스페이스</p>${Object.entries(routes).map(([id, page]) => `<a href="#${id}" aria-label="${page.name}" title="${page.name}"${id === route ? ' class="active" aria-current="page"' : ''}>${icon(page.icon, 20)}<span>${page.name}</span>${id === route ? '<span class="nav-mark"></span>' : ''}</a>`).join('')}</nav>
      <div class="sidebar-bottom">
        <div class="sidebar-progress"><span class="side-progress-icon">${icon('complete', 19)}</span><div><strong>커리큘럼 진행률</strong><p>${p.completed} / ${p.classes}개 수업 완료</p></div><b>${p.completedPercent}%</b>${meter(p.completedPercent)}</div>
        <div class="sidebar-local"><span class="local-dot"></span><span>로컬 워크스페이스</span></div>
      </div>
    </aside>
    ${ui.menu ? `<button class="menu-scrim" aria-label="메뉴 닫기" data-action="menu"></button>` : ''}
    <div class="workspace">
      <header class="topbar">
        <div class="topbar-page"><button class="icon-button mobile-menu" aria-label="메뉴 열기" aria-expanded="${ui.menu}" aria-controls="workspace-menu" data-action="menu">${icon('menu')}</button><span>${routes[route].name}</span></div>
        <div class="topbar-meta">${state.demo ? `<a href="#materials" class="demo-mark" title="커리큘럼 가져오기">예시 데이터</a>` : ''}<time datetime="${state.today}">${icon('calendar', 17)}<span>${dateLabel(state.today)}</span></time></div>
      </header>
      <main id="main" tabindex="-1">${content}</main>
    </div>
  </div>`;
}

function metricCards(state, includeNotes = true) {
  const p = progress(state);
  const stats = [
    ['calendar', 'green', '수강일 경과율', `${p.elapsedPercent}<small>%</small>`, `전체 ${p.days}일 중 ${p.elapsed}일 경과`, meter(p.elapsedPercent)],
    ['complete', 'blue', '커리큘럼 완료율', `${p.completedPercent}<small>%</small>`, `전체 ${p.classes}개 중 ${p.completed}개 완료`, meter(p.completedPercent, 'blue')]
  ];
  if (includeNotes) stats.push(['note', 'amber', '수업 기록', `${p.notes}<small>일</small>`, p.notes ? '기록을 남긴 수업일' : '첫 수업 기록을 남겨보세요', '<span class="metric-rule"></span>']);
  return `<section class="metric-grid ${includeNotes ? '' : 'metric-grid--two'}" aria-label="수업 진도 요약">${stats.map(([symbol, color, label, value, subtitle, track]) => `<article class="card metric"><div class="metric-head">${tile(symbol, color)}<h2>${label}</h2></div><div class="metric-value">${value}</div><p>${subtitle}</p>${track}</article>`).join('')}</section>`;
}

function hero(state) {
  const lesson = state.lessons.find(({ date, done }) => date === state.today && !done) ?? state.lessons.find(({ date }) => date === state.today);
  const next = !lesson && state.lessons.find(({ date }) => date > state.today);
  const current = lesson || next;
  const headline = lesson ? '오늘의 수업' : next ? '다음 수업' : state.lessons.length ? '부트캠프 복습' : '커리큘럼으로 시작하기';
  const detail = current ? `${esc(current.unit)} <span class="hero-separator">/</span> <strong>${esc(current.title)}</strong>${next ? ` <span class="hero-separator">/</span> ${compactDate(current.date)}` : ''}` :
    state.lessons.length ? '지금까지의 수업을 문제와 요약으로 복습하세요.' : 'CSV를 업로드하면 수업 일정과 진도가 자동으로 표시됩니다.';
  return `<section class="hero">
    <div class="hero-content"><span class="hero-label">${icon('book', 17)} 부트캠프 학습 공간</span><h2>${headline}</h2><p>${detail}</p><div class="hero-actions">
      ${current ? button('수업 기록하기', 'edit', `data-action="note" data-date="${state.today}"`) : state.lessons.length ? link('복습 시작하기', 'spark', 'review', 'primary') : link('커리큘럼 CSV 업로드', 'upload', 'materials', 'primary')}
      ${state.demo ? textLink('내 커리큘럼 가져오기', 'materials') : current ? textLink('전체 수업 보기', 'lessons') : ''}
    </div></div>
    <div class="hero-art" aria-hidden="true">
      <div class="art-grid"></div><div class="art-orbit art-orbit--outer"></div><div class="art-orbit art-orbit--inner"></div><span class="art-star art-star--one">✧</span><span class="art-star art-star--two">✦</span><span class="art-dot"></span>
      <div class="art-window"><div class="art-window-top"><i></i><i></i><i></i><b></b></div><div class="art-window-body"><span class="art-code">&lt;/&gt;</span><div class="art-lines"><i></i><i></i><i></i></div></div></div>
      <div class="art-complete">${icon('check', 24)}</div><div class="art-chart"><i></i><i></i><i></i><i></i></div>
    </div>
  </section>`;
}

function weeklyActivity(state, week) {
  const monday = offsetDate(state.today, -((dateObject(state.today).getUTCDay() + 6) % 7) + week * 7);
  const dates = Array.from({ length: 7 }, (_, index) => offsetDate(monday, index));
  const completedDates = new Set(state.lessons.filter(({ done }) => done).map(({ date }) => date));
  return `<article class="card activity"><header class="section-head"><div><h2>주간 학습 활동</h2><p>${compactDate(dates[0])} – ${compactDate(dates[6])}</p></div><div class="week-buttons"><button class="icon-button" aria-label="이전 주" data-action="week" data-direction="-1">${icon('left', 18)}</button><button class="icon-button" aria-label="다음 주" data-action="week" data-direction="1">${icon('chevron', 18)}</button></div></header>
    <ul class="activity-days" role="list" aria-label="날짜별 수업 완료 여부">${dates.map((day) => {
      const done = completedDates.has(day);
      const status = done ? '완료한 수업 있음' : '완료한 수업 없음';
      return `<li class="activity-day" title="${dateLabel(day)} · ${status}">
        <span class="activity-circle${done ? ' activity-circle--done' : ''}" role="img" aria-label="${status}">${done ? icon('check', 19) : ''}</span>
        <time datetime="${day}"${day === state.today ? ' aria-current="date"' : ''}><span>${days[dateObject(day).getUTCDay()]}</span><small>${compactDate(day)}</small></time>
      </li>`;
    }).join('')}</ul></article>`;
}

function subjectProgress(state) {
  const subjects = new Map();
  for (const lesson of state.lessons) {
    const subject = lesson.subject || (lesson.unit === '기본 커리큘럼' ? lesson.title : lesson.unit) || lesson.title;
    const stats = subjects.get(subject) ?? { total: 0, done: 0 };
    stats.total++;
    stats.done += Number(lesson.done);
    subjects.set(subject, stats);
  }
  return `<article class="card curriculum"><header class="section-head"><h2>과목별 진행률</h2><a class="icon-button" href="#lessons" aria-label="전체 커리큘럼 보기">${icon('list', 19)}</a></header>
    ${subjects.size ? `<ul class="subject-list" role="list" aria-label="커리큘럼 과목" tabindex="0">${[...subjects].map(([subject, { done, total }]) => {
      const value = percent(done, total);
      return `<li class="subject"><div class="subject-heading"><span>${esc(subject)}</span><span class="subject-count">${done} / ${total}개 <strong>${value}%</strong></span></div>${meter(value, 'green', `${subject} 진행률`)}</li>`;
    }).join('')}</ul>` : blank('book', '등록된 과목이 없습니다', '커리큘럼 CSV를 올려 수업을 추가하세요.', textLink('CSV 업로드', 'materials'))}</article>`;
}

function recentNotes(state) {
  const notes = Object.entries(state.notes).sort(([a], [b]) => b.localeCompare(a)).slice(0, 3);
  return `<section class="card recent"><header class="section-head"><div><h2>최근 수업 기록</h2><p>날짜별로 남긴 학습 메모</p></div>${textLink('전체 기록 보기', 'lessons')}</header>${notes.length ? `<div class="recent-list">${notes.map(([date, note]) => {
    const title = state.lessons.find((lesson) => lesson.date === date)?.title ?? '수업 기록';
    return `<button class="recent-row" data-action="note" data-date="${date}">${tile('note')}<span class="recent-text"><strong>${esc(title)}</strong><span>${esc(note)}</span></span><time datetime="${date}">${compactDate(date)}</time>${icon('chevron', 17)}</button>`;
  }).join('')}</div>` : blank('note', '아직 기록이 없습니다', '오늘 배운 내용을 짧게 적어두세요.', button('수업 기록하기', 'edit', `data-action="note" data-date="${state.today}"`, 'secondary'))}</section>`;
}

function dashboard(state, ui) {
  return `${pageHeading('home', link('복습 시작하기', 'spark', 'review'))}${hero(state)}${metricCards(state)}<section class="chart-grid-layout">${weeklyActivity(state, ui.week)}${subjectProgress(state)}</section>${recentNotes(state)}`;
}

function lessonsPage(state, ui) {
  const groups = new Map();
  for (const lesson of state.lessons) {
    if (!groups.has(lesson.date)) groups.set(lesson.date, []);
    groups.get(lesson.date).push(lesson);
  }
  for (const date of Object.keys(state.notes)) if (!groups.has(date)) groups.set(date, []);
  const rows = [...groups].sort(([a], [b]) => {
    if ((a > state.today) !== (b > state.today)) return a > state.today ? 1 : -1;
    return a > state.today ? a.localeCompare(b) : b.localeCompare(a);
  }).filter(([date, lessons]) => ui.lessonFilter === 'all' || (ui.lessonFilter === 'done' && lessons.some(({ done }) => done)) ||
    (ui.lessonFilter === 'upcoming' && date > state.today) || (ui.lessonFilter === 'notes' && state.notes[date]));
  return `${pageHeading('lessons', button('수업 기록 추가', 'plus', `data-action="note" data-date="${state.today}"`))}${metricCards(state, false)}
  <section class="card lesson-board"><header class="section-head"><div><h2>날짜별 수업</h2><p>${state.curriculum ? esc(state.curriculum.name) : state.demo ? '예시 커리큘럼' : '커리큘럼 업로드 대기 중'}</p></div>${link('커리큘럼 업로드', 'upload', 'materials')}</header>
  <div class="filter-row" aria-label="수업 필터">${[['all', '전체'], ['done', '완료'], ['upcoming', '예정'], ['notes', '기록 있음']].map(([id, label]) => `<button class="filter ${ui.lessonFilter === id ? 'filter--active' : ''}" data-action="lesson-filter" data-filter="${id}" aria-pressed="${ui.lessonFilter === id}">${label}</button>`).join('')}</div>
  ${rows.length ? `<div class="lesson-list">${rows.map(([date, lessons]) => {
    const note = state.notes[date];
    return `<article class="lesson-day"><time datetime="${date}"><span>${compactDate(date)}</span><small>${days[dateObject(date).getUTCDay()]}요일</small></time><div class="lesson-day-main">
      ${lessons.map((lesson) => `<div class="lesson-item"><label class="lesson-check"><input type="checkbox" data-action="lesson" data-id="${esc(lesson.id)}" ${lesson.done ? 'checked' : ''} ${state.demo ? 'disabled' : ''}><span>${esc(lesson.title)}</span></label>${tag(esc(lesson.unit))}</div>`).join('')}
      ${note ? `<details class="lesson-note-disclosure" data-note-date="${date}"${ui.openLessonNotes.has(date) ? ' open' : ''}>
        <summary aria-label="${dateLabel(date)} 수업 기록 있음">${tag('기록 있음', 'green')}${icon('down', 16)}</summary><p class="lesson-note">${esc(note)}</p>
      </details>` : ''}</div><div class="lesson-actions">${date === state.today ? tag('오늘', 'green') : date > state.today ? tag('예정') : ''}${button(note ? '기록 편집' : '기록 작성', 'edit', `data-action="note" data-date="${date}"`, 'quiet')}</div></article>`;
  }).join('')}</div>` : blank('calendar', '표시할 수업이 없습니다', ui.lessonFilter === 'all' ? 'CSV를 업로드하거나 날짜별 수업 기록을 추가하세요.' : '다른 필터에서 수업을 확인하세요.')}</section>`;
}

function curriculumCard(state) {
  return `<section class="card config-card curriculum-config" id="curriculum-upload">${heading('calendar', '커리큘럼 CSV', '수업 일정과 진도 계산에 사용할 파일을 올리세요.')}
    <form data-form="curriculum"><label class="drop"><span class="upload-icon">${icon('upload', 21)}</span><span><strong>CSV 파일 선택</strong><small data-file-label>CSV · 최대 2MB</small></span><input type="file" name="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" required></label>
    <div class="config-footer">${button('커리큘럼 업로드', 'upload', 'type="submit"')}${button('CSV 양식 다운로드', 'download', 'type="button" data-action="template"', 'quiet')}</div></form>
    ${state.curriculum ? `<div class="config-message">${icon('check', 18)} <span><strong>${esc(state.curriculum.name)}</strong> · ${state.lessons.length}개 수업</span></div>` : `<p class="field-help">날짜 열과 주제 또는 과목 열이 필요합니다. 단원과 완료 열도 함께 올릴 수 있습니다.</p>`}
  </section>`;
}

function modelCard(state, ui) {
  const options = [...new Set([...ui.models, ...state.models, state.model])];
  return `<section class="card config-card" id="gpt-settings">${heading('key', 'OpenAI API 설정', '문제와 요약을 생성할 모델과 API 키를 설정하세요.', 'blue')}
    <form data-form="settings"><label class="field">GPT 모델<select name="model">${options.map((name) => `<option value="${esc(name)}"${selected(name, state.model)}>${esc(name)}</option>`).join('')}</select></label>
    <label class="field">OpenAI API 키<input type="password" name="apiKey" autocomplete="off" placeholder="${state.keySet ? '키 저장됨 · 변경하려면 새 키 입력' : 'sk-…'}"></label>
    <div class="config-footer">${button('설정 저장', 'check', 'type="submit"')}${button('모델 목록 가져오기', '', 'type="button" data-action="models"', 'quiet')}</div>
    ${state.keySet ? `<div class="config-message">${icon('check', 18)} <span>이 실행 세션에 API 키가 저장되어 있습니다.</span>${button('키 지우기', '', 'type="button" data-action="clear-key"', 'quiet')}</div>` : '<p class="field-help">키는 서버가 실행되는 동안 메모리에만 보관됩니다.</p>'}</form>
  </section>`;
}

function scopeInput(prefix, defaultValue = 'auto', date = '') {
  return `<div class="field-row"><label class="field">자료 학습 범위<select name="scope" data-scope="${prefix}"><option value="auto"${selected(defaultValue, 'auto')}>파일명에서 수업 날짜 찾기</option><option value="all"${selected(defaultValue, 'all')}>모든 수업에 사용하는 공통 자료</option><option value="date"${selected(defaultValue, 'date')}>수업 날짜 지정</option></select></label><label class="field scope-date" ${defaultValue === 'date' ? '' : 'hidden'}>수업 날짜<input type="date" name="scopeDate" value="${esc(date)}" ${defaultValue === 'date' ? 'required' : ''}></label></div>`;
}

function githubCard(state) {
  const data = state.connections.github;
  return `<section class="card config-card">${heading('github', 'GitHub 저장소', '저장소의 실습 코드와 학습 자료를 가져오세요.')}
    <form data-form="github"><label class="field">저장소 주소<input name="url" placeholder="https://github.com/계정/저장소" value="${esc(data?.url)}" required></label>
    <details class="config-details"><summary>브랜치, 하위 폴더, 비공개 저장소 설정</summary><div class="field-row two"><label class="field">브랜치<input name="branch" placeholder="기본 브랜치" value="${esc(data?.branch)}"></label><label class="field">하위 폴더<input name="folder" placeholder="예  week-01" value="${esc(data?.folder)}"></label></div>
    <label class="field">GitHub 액세스 토큰<input type="password" name="token" autocomplete="off" placeholder="${state.githubSignedIn ? '이 실행 세션에 토큰 저장됨' : '비공개 저장소에 필요'}"></label><p class="field-help">비공개 저장소는 해당 저장소의 Contents 읽기 권한이 있는 토큰이 필요합니다.</p></details>
    ${scopeInput('github')}${button(data ? 'GitHub 다시 가져오기' : 'GitHub에서 가져오기', 'link', 'type="submit"')}
    ${data ? `<div class="config-message">${icon('check', 18)} <span>최근 가져온 브랜치 · <strong>${esc(data.branch)}</strong>${data.folder ? ` / ${esc(data.folder)}` : ''}</span></div>` : ''}</form>
  </section>`;
}

function driveCard(state, ui) {
  const data = state.connections.drive;
  const mode = ui.driveMode || data?.mode || 'public';
  return `<section class="card config-card">${heading('drive', 'Google Drive 폴더', '공유 폴더 또는 내가 접근할 수 있는 폴더를 가져오세요.', 'amber')}
    <form data-form="drive"><label class="field">폴더 주소 또는 ID<input name="url" placeholder="https://drive.google.com/drive/folders/…" value="${esc(ui.driveUrl ?? data?.url ?? state.drivePendingUrl)}" required></label>
    <label class="field">연결 방식<select name="mode" data-action="drive-mode"><option value="public"${selected(mode, 'public')}>링크로 공유된 폴더</option><option value="oauth"${selected(mode, 'oauth')}>Google 계정으로 연결</option></select></label>
    ${mode === 'public' ? `<label class="field">Google Cloud API 키<input type="password" name="apiKey" autocomplete="off" placeholder="${state.driveKeySet ? '이 실행 세션에 키 저장됨' : 'Drive API가 활성화된 키'}" ${state.driveKeySet ? '' : 'required'}></label>` : state.driveSignedIn ? `<p class="config-message">${icon('check', 18)} Google 계정이 연결되어 있습니다.</p>` : `<div class="field-row two"><label class="field">데스크톱 앱 클라이언트 ID<input name="clientId" autocomplete="off" required></label><label class="field">클라이언트 보안 비밀번호<input type="password" name="clientSecret" autocomplete="off" required></label></div><p class="field-help">Google Cloud에서 Drive API를 활성화하고 데스크톱 앱 OAuth 클라이언트를 만드세요.</p>`}
    ${scopeInput('drive', ui.driveScope, ui.driveScopeDate || state.today)}${button(mode === 'oauth' && !state.driveSignedIn ? 'Google 계정 연결 및 가져오기' : 'Drive에서 가져오기', 'link', 'type="submit"')}
    ${data ? `<div class="config-message">${icon('check', 18)} <span>최근 가져온 폴더 · <strong>${esc(data.name)}</strong></span></div>` : ''}</form>
  </section>`;
}

function fileSize(bytes) {
  return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function materialsPage(state, ui) {
  return `${pageHeading('materials')}
    <div class="config-grid">${curriculumCard(state)}${modelCard(state, ui)}${githubCard(state)}${driveCard(state, ui)}</div>
    <section class="card config-card upload-card">${heading('upload', '추가 자료 업로드', '강의 노트, 코드, 문서 파일을 추가하세요.')}
    <form data-form="upload"><label class="drop"><span class="upload-icon">${icon('upload', 21)}</span><span><strong>학습 파일 선택</strong><small data-file-label>텍스트, 코드, PDF, DOCX, PPTX, XLSX · 파일당 최대 8MB</small></span><input type="file" name="files" multiple required></label>${scopeInput('upload')}${button('선택한 자료 업로드', 'plus', 'type="submit"')}</form></section>
    <section class="card materials-list"><header class="section-head"><div><h2>가져온 학습 자료</h2><p>${state.materials.length}개 · 커리큘럼이 있으면 날짜가 지정된 자료와 공통 자료를 생성에 사용합니다.</p></div></header>
    ${state.materials.length ? `<div class="material-rows">${[...state.materials].reverse().map((item) => `<article class="material-row">${tile(item.kind === 'text' ? 'note' : 'folder', 'blue')}<div class="material-name"><strong title="${esc(item.name)}">${esc(item.name)}</strong><span>${{ github: 'GitHub', drive: 'Google Drive', upload: '직접 업로드' }[item.origin]} · ${fileSize(item.size)}</span></div><button type="button" class="scope-button" data-action="edit-scope" data-id="${esc(item.id)}" aria-label="${esc(item.name)} 학습 범위 편집">${tag(item.scope === 'all' ? '공통 자료' : item.scope ? esc(item.scope) : '날짜 확인 필요', item.scope ? 'green' : 'amber')}${icon('edit', 15)}</button><button class="icon-button danger" aria-label="${esc(item.name)} 삭제" data-action="remove-material" data-id="${esc(item.id)}">${icon('trash', 17)}</button></article>`).join('')}</div>` : blank('folder', '아직 가져온 자료가 없습니다', 'GitHub, Google Drive 또는 내 컴퓨터의 파일을 추가하세요.')}</section>`;
}

function reviewForm(state, ui) {
  const tab = ui.reviewTab;
  const quiz = tab === 'quiz';
  const dates = [...new Set([...state.lessons.map(({ date }) => date), ...Object.keys(state.notes)])].filter((day) => day <= state.today).reverse().sort((a, b) => b.localeCompare(a));
  return `<section class="card review-config">${heading(quiz ? 'spark' : 'book', quiz ? '문제 생성 설정' : '요약 생성 설정', quiz ? '학습 범위와 문제 개수를 선택하세요.' : '요약할 학습 범위를 선택하세요.')}
    <form data-form="study">
    ${quiz ? `<label class="field">문제 유형<select name="kind"><option value="mixed"${selected(ui.quizKind, 'mixed')}>이론 + 코딩</option><option value="theory"${selected(ui.quizKind, 'theory')}>이론 문제</option><option value="coding"${selected(ui.quizKind, 'coding')}>코딩테스트</option></select></label><label class="field">문제 개수<input type="number" name="count" min="1" max="15" step="1" value="${esc(ui.count)}" required></label>` : ''}
    <label class="field">학습 범위<select name="date"><option value="">오늘까지의 전체 수업</option>${dates.map((date) => `<option value="${date}"${selected(date, ui.studyDate)}>${date} 수업</option>`).join('')}</select></label>
    <div class="review-model"><span>${icon('key', 16)} GPT 모델</span><strong>${esc(state.model)}</strong></div>
    ${state.keySet ? button(quiz ? '문제 생성하기' : '학습 요약 생성하기', 'spark', 'type="submit"', 'primary') : `<div class="review-key">${icon('info', 18)} <span>생성하려면 OpenAI API 키를 저장하세요.</span></div>${link('API 키 설정하기', 'key', 'materials', 'primary')}`}
    ${state.demo && quiz ? button('예시 문제 풀기', 'terminal', 'type="button" data-action="sample"', 'secondary') : ''}
    <p class="field-help">생성 시 선택한 범위의 커리큘럼, 날짜별 수업 기록, 학습 파일이 OpenAI API로 전송됩니다.${quiz ? '' : ' 수업 기록은 핵심 개념의 이해와 복습에 도움이 되는 부분만 요약에 반영합니다.'}</p></form>
  </section>`;
}

function sourceTags(ids, sources) {
  return ids?.length ? `<div class="source-tags" aria-label="참고자료">${ids.map((id) => tag(esc(sources[id] ?? id))).join('')}</div>` : '';
}

function materialCoverage(result) {
  return result.eligibleFiles > result.usedFiles ? `<p class="field-help">선택 범위의 파일 ${result.eligibleFiles}개 중 ${result.usedFiles}개를 참고했습니다.</p>` : '';
}

function quizResult(quiz, ui) {
  if (!quiz) return `<section class="card workspace-empty">${blank('spark', '아직 생성된 문제가 없습니다', '설정에서 문제 개수와 학습 범위를 선택해 첫 문제를 만들어 보세요.')}</section>`;
  const question = quiz.questions.find(({ id }) => id === ui.question) ?? quiz.questions[0];
  const number = quiz.questions.indexOf(question) + 1;
  const solved = quiz.questions.filter(({ attempt }) => attempt).length;
  const coding = question.type === 'coding';
  return `<section class="card study-result"><header class="section-head"><div><h2>${esc(quiz.title)}</h2><p>${quiz.sample ? '예시 문제' : quiz.date || '오늘까지의 수업'} · ${solved} / ${quiz.questions.length}문제 제출</p></div>${tag(`${percent(solved, quiz.questions.length)}%`, 'green')}</header><div class="question-track" aria-label="문제 선택">${quiz.questions.map((item, index) => `<button class="question-number ${item.id === question.id ? 'current' : ''} ${item.attempt ? 'answered' : ''}" data-action="question" data-id="${esc(item.id)}" aria-label="${index + 1}번 문제${item.attempt ? ', 제출 완료' : ''}"${item.id === question.id ? ' aria-current="step"' : ''}>${index + 1}</button>`).join('')}</div>
    <article class="question"><div class="question-meta">${tag(coding ? `코딩테스트 · ${esc(question.language)}` : '이론 문제', coding ? 'blue' : 'green')}<span>${number} / ${quiz.questions.length}</span></div><h3>${esc(question.title)}</h3><p class="formatted">${esc(question.prompt)}</p>
    ${question.examples?.length ? `<div class="examples">${question.examples.map(({ input, output }) => `<div><span>입력 <code>${esc(input)}</code></span><span>출력 <code>${esc(output)}</code></span></div>`).join('')}</div>` : ''}
    ${question.hint ? `<details class="hint"><summary>${icon('bulb', 17)} 힌트 보기</summary><p class="formatted">${esc(question.hint)}</p></details>` : ''}
    <form data-form="answer" data-id="${esc(question.id)}" data-quiz="${esc(quiz.id)}"><label class="field">${coding ? '내 코드' : '내 답안'}<textarea name="answer" rows="${coding ? 8 : 4}" maxlength="15000" class="${coding ? 'code-editor' : ''}" ${coding ? 'spellcheck="false" autocapitalize="off"' : ''} required placeholder="${coding ? '코드를 입력하세요.' : '답안을 입력하세요.'}">${esc(ui.drafts[question.id] ?? question.attempt?.text ?? question.starter)}</textarea></label>${button(question.attempt ? '답안 다시 저장' : '답안 제출하고 정답 확인', 'check', 'type="submit"')}</form>
    ${question.attempt ? `<section class="answer"><h4>${icon('complete', 19)} ${coding ? '모범 코드' : '모범 답안'}</h4>${coding ? `<pre><code>${esc(question.answer)}</code></pre>` : `<p class="formatted">${esc(question.answer)}</p>`}<h4>풀이 설명</h4><p class="formatted">${esc(question.explanation)}</p>${sourceTags(question.sources, quiz.sources)}</section>` : ''}
    ${materialCoverage(quiz)}</article></section>`;
}

function summaryResult(summary) {
  if (!summary) return `<section class="card workspace-empty">${blank('book', '아직 생성된 요약이 없습니다', '학습 범위를 선택하고 핵심 개념을 정리해 보세요.')}</section>`;
  return `<section class="card study-result summary-result"><header class="section-head"><div><h2>${esc(summary.title)}</h2><p>${summary.date || '오늘까지의 수업'} · ${esc(summary.model)}</p></div>${button('Markdown 저장', 'download', 'data-action="download-summary"', 'secondary')}</header><p class="summary-overview formatted">${esc(summary.overview)}</p>
    ${summary.sections.map((section) => `<section class="summary-section"><h3>${esc(section.title)}</h3><p class="formatted">${esc(section.explanation)}</p>${section.takeaways.length ? `<ul>${section.takeaways.map((point) => `<li>${esc(point)}</li>`).join('')}</ul>` : ''}${sourceTags(section.sources, summary.sources)}</section>`).join('')}
    ${summary.checklist.length ? `<section class="summary-section summary-checklist"><h3>복습 체크리스트</h3><ul>${summary.checklist.map((point) => `<li>${esc(point)}</li>`).join('')}</ul></section>` : ''}${materialCoverage(summary)}</section>`;
}

function reviewPage(state, ui) {
  return `${pageHeading('review')}<div class="review-tabs" role="group" aria-label="복습 방식">${[['quiz', 'terminal', '문제 풀이'], ['summary', 'book', '요약 학습자료']].map(([id, symbol, label]) => `<button class="review-tab ${ui.reviewTab === id ? 'active' : ''}" aria-pressed="${ui.reviewTab === id}" data-action="review-tab" data-tab="${id}">${icon(symbol, 19)} ${label}</button>`).join('')}</div>
  <div class="review-grid">${reviewForm(state, ui)}${ui.reviewTab === 'quiz' ? quizResult(state.quiz, ui) : summaryResult(state.summary)}</div>`;
}

export function view(state, route, ui) {
  let content;
  if (route === 'lessons') content = lessonsPage(state, ui);
  else if (route === 'materials') content = materialsPage(state, ui);
  else if (route === 'review') content = reviewPage(state, ui);
  else content = dashboard(state, ui);
  return shell(state, route, content, ui);
}

export function noteDialog(state, date) {
  return `<header class="dialog-head"><div><h2 id="dialog-title">수업 기록</h2><p>배운 개념과 실습 내용을 기록하세요.</p></div><button class="icon-button" data-action="close-dialog" aria-label="닫기">${icon('close')}</button></header>
  <form data-form="note"><label class="field">수업 날짜<input type="date" name="date" value="${esc(date)}" required></label>${state.demo && state.notes[date] ? `<p class="field-help">예시 기록 · ${esc(state.notes[date])}</p>` : ''}<label class="field">수업 내용<textarea name="note" rows="6" maxlength="12000" placeholder="오늘 배운 내용과 다시 보고 싶은 부분을 적어보세요.">${state.demo ? '' : esc(state.notes[date])}</textarea></label>
  ${state.demo ? '<p class="field-help">저장하면 내 학습 공간으로 전환됩니다. 예시 기록은 가져오지 않습니다.</p>' : ''}<div class="dialog-actions">${button('취소', '', 'type="button" data-action="close-dialog"', 'secondary')}${button('기록 저장', 'check', 'type="submit"')}</div></form>`;
}

export function scopeDialog(item) {
  const choice = !item.scope ? '' : item.scope === 'all' ? 'all' : 'date';
  return `<header class="dialog-head"><div><h2 id="dialog-title">자료 학습 범위</h2><p>${esc(item.name)}</p></div><button class="icon-button" data-action="close-dialog" aria-label="닫기">${icon('close')}</button></header>
  <form data-form="scope" data-id="${esc(item.id)}"><label class="field">사용할 범위<select name="scope" data-scope="edit"><option value=""${selected(choice, '')}>날짜 확인 필요</option><option value="all"${selected(choice, 'all')}>공통 자료</option><option value="date"${selected(choice, 'date')}>수업 날짜 지정</option></select></label><label class="field scope-date" ${choice === 'date' ? '' : 'hidden'}>수업 날짜<input type="date" name="scopeDate" value="${choice === 'date' ? esc(item.scope) : ''}" ${choice === 'date' ? 'required' : ''}></label>
  <p class="field-help">공통 자료는 모든 수업에 사용할 수 있습니다.</p><div class="dialog-actions">${button('취소', '', 'type="button" data-action="close-dialog"', 'secondary')}${button('범위 저장', 'check', 'type="submit"')}</div></form>`;
}

export function removeDialog(item) {
  return `<header class="dialog-head"><div><h2 id="dialog-title">자료 삭제</h2><p>${esc(item.name)}</p></div><button class="icon-button" data-action="close-dialog" aria-label="닫기">${icon('close')}</button></header><form data-form="remove" data-id="${esc(item.id)}"><p>이 학습 공간에서 선택한 자료를 삭제할까요?</p><div class="dialog-actions">${button('취소', '', 'type="button" data-action="close-dialog"', 'secondary')}${button('자료 삭제', 'trash', 'type="submit"', 'danger')}</div></form>`;
}
