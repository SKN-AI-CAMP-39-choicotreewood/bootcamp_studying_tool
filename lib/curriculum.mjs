export const normalize = (value) => String(value ?? '').trim();

export function todayInKorea(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === date;
}

export function offsetDate(date, number) {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + number);
  return parsed.toISOString().slice(0, 10);
}

export function decodeText(buffer) {
  if (buffer[0] === 255 && buffer[1] === 254) return new TextDecoder('utf-16le').decode(buffer);
  if (buffer[0] === 254 && buffer[1] === 255) return new TextDecoder('utf-16be').decode(buffer);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    // Korean spreadsheets sometimes export legacy Windows encodings.
    return new TextDecoder('euc-kr').decode(buffer);
  }
}

function csvRows(text) {
  const firstLine = text.split(/\r?\n/, 1)[0].replace(/"(?:[^"]|"")*"/g, '');
  const separator = firstLine.includes('\t') && !firstLine.includes(',') ? '\t' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  // Quoted cells can contain the delimiter, escaped quotes, or line breaks.
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index++;
      } else if (quoted || !field) {
        quoted = !quoted;
      } else {
        field += char;
      }
    } else if (!quoted && (char === separator || char === '\n' || char === '\r')) {
      row.push(field.trim());
      field = '';
      if (char !== separator) {
        if (row.some(Boolean)) rows.push(row);
        row = [];
        if (char === '\r' && text[index + 1] === '\n') index++;
      }
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('CSV의 닫히지 않은 따옴표를 확인해 주세요.');
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function csvDate(value) {
  const fields = value.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})(?:일|\s|T|\(|$)/) ?? value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!fields) return '';
  const date = `${fields[1]}-${fields[2].padStart(2, '0')}-${fields[3].padStart(2, '0')}`;
  return validDate(date) ? date : '';
}

export function parseCurriculum(buffer) {
  const [header = [], ...rows] = csvRows(decodeText(buffer).replace(/^\uFEFF/, ''));
  const columns = header.map((item) => item.toLowerCase().replace(/[\s_-]/g, ''));
  const find = (...aliases) => columns.findIndex((name) => aliases.includes(name));
  const dateColumn = find('날짜', '일자', '수업일', '수업일자', '시작일', '교육일자', 'date', 'startdate', 'day');
  const titleColumn = find('제목', '수업', '수업명', '학습주제', '학습내용', '수업내용', '교육내용', '주제', '내용', '커리큘럼', 'title', 'lesson', 'topic');
  const subjectColumn = find('과목', '과목명', '교과목', '교과목명', 'subject', 'subjectname');
  const unitColumn = find('단원', '분류', '모듈', '분야', '대분류', '카테고리', '챕터', 'unit', 'module', 'category', 'track');
  const statusColumn = find('완료', '상태', '진도', '완료여부', 'completed', 'status', 'done');
  if (dateColumn < 0 || (titleColumn < 0 && subjectColumn < 0)) throw new Error('CSV에 날짜 열과 주제 또는 과목 열이 필요합니다. 자료 구성의 CSV 양식을 참고해 주세요.');
  if (!rows.length || rows.length > 1500) throw new Error('수업 일정을 1개 이상, 1,500개 이하로 입력해 주세요.');
  const lessons = new Map();
  for (const [index, row] of rows.entries()) {
    const date = csvDate(row[dateColumn] ?? '');
    const subject = normalize(row[subjectColumn]).slice(0, 250);
    const title = normalize(row[titleColumn]).slice(0, 250) || subject;
    if (!date || !title) throw new Error(`${index + 2}번째 데이터 줄의 날짜, 주제 또는 과목을 확인해 주세요.`);
    const unit = normalize(row[unitColumn]).slice(0, 100) || (titleColumn >= 0 ? subject.slice(0, 100) : '') || '기본 커리큘럼';
    const id = lessonId(date, title, unit, subject);
    const status = normalize(row[statusColumn]).toLowerCase();
    lessons.set(id, { id, date, title, unit, ...(subject ? { subject } : {}), done: /^(1|true|yes|y|o|완료|수강완료|수강 완료|done|completed)$/.test(status) });
  }
  return [...lessons.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function lessonId(date, title, unit, subject = '') {
  // This identity lets a later CSV import retain the same lesson's completion.
  const parts = [date, title, unit];
  if (subject && subject !== title && subject !== unit) parts.push(subject);
  return JSON.stringify(parts);
}

export function demoState(today) {
  const topics = [
    ['HTML 시맨틱 구조', '웹 기초'], ['CSS 선택자와 레이아웃', '웹 기초'], ['Flexbox와 Grid', '웹 기초'], ['반응형 웹 실습', '웹 기초'],
    ['변수와 자료형', 'JavaScript'], ['조건문과 반복문', 'JavaScript'], ['함수와 스코프', 'JavaScript'], ['배열과 객체', 'JavaScript'],
    ['배열 메서드 실습', 'JavaScript'], ['DOM 조작과 이벤트', 'JavaScript'], ['비동기 처리와 Promise', 'JavaScript'], ['Fetch API 실습', 'JavaScript'],
    ['React 컴포넌트', 'React'], ['Props와 State', 'React'], ['React Hooks', 'React'], ['상태 관리', 'React'],
    ['라우팅과 폼', 'React'], ['프로젝트 기획', '프로젝트'], ['프로젝트 구현', '프로젝트'], ['리팩터링과 발표', '프로젝트']
  ];
  const weekdays = [];
  const future = [];
  for (let offset = -40; offset <= 30; offset++) {
    const date = offsetDate(today, offset);
    const day = new Date(`${date}T12:00:00Z`).getUTCDay();
    if (day === 0 || day === 6) continue;
    (offset <= 0 ? weekdays : future).push(date);
  }
  const dates = [...weekdays.slice(-10), ...future.slice(0, 10)];
  const lessons = topics.map(([title, unit], index) => ({ id: lessonId(dates[index], title, unit), date: dates[index], title, unit, done: index < 8 }));
  const notes = {
    [dates[7]]: '배열과 객체의 차이를 정리하고 구조 분해 할당을 실습했다.',
    [dates[6]]: '함수 선언과 함수 표현식의 차이, 블록 스코프를 복습했다.',
    [dates[5]]: 'for…of 반복문으로 배열을 순회하고 조건을 적용했다.',
    [dates[3]]: '브레이크포인트와 미디어 쿼리를 사용해 레이아웃을 바꿨다.'
  };
  return { lessons, notes };
}
