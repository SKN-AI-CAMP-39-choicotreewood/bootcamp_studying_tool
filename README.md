# Bootcamp Studying Tool

부트캠프 커리큘럼, 수업 기록, 실습 파일을 한곳에 모아 진도를 확인하고 복습하는 한국어 웹앱입니다. Node.js로 자신의 컴퓨터에서 실행합니다.

## 로컬에서 실행하기

Windows 파일 탐색기에서 프로젝트 폴더의 `start.bat`를 더블클릭하세요. 로컬 서버가 꺼져 있으면 백그라운드에서 시작하고, 서버가 준비되면 기본 브라우저에서 학습 도구를 엽니다. 다른 Windows PC에서 처음 실행할 때는 아래의 초기 설정을 먼저 진행하세요.

Windows 로그인 시 서버가 자동으로 시작되는 PC에서는 브라우저에서 바로 접속할 수도 있습니다. [Bootcamp Studying Tool 열기](http://127.0.0.1:4173/)

자동 시작을 중지하려면 Windows에서 `shell:startup`을 열고 `Bootcamp Studying Tool` 바로가기를 제거합니다. [Windows 시작 앱 설정](https://support.microsoft.com/en-gb/windows/experience/startup-boot/configure-startup-applications-in-windows)

### Windows 초기 설정

처음 설치하거나 자동 시작 설정을 복구하려면 PowerShell에서 프로젝트 폴더를 열고 `windows/setup.ps1`을 실행합니다. 이 스크립트는 공식 Node.js 실행 파일의 SHA-256을 확인하고 `.runtime`에 Node.js와 앱 실행기를 준비한 뒤, 현재 사용자의 자동 시작 바로가기를 설치합니다. [Node.js 공식 다운로드](https://nodejs.org/en/download)

### 개발용 터미널 실행

개발 중 터미널에서 실행하려면 먼저 작업 관리자에서 이 앱이 실행한 `node.exe`를 종료합니다. 같은 데이터 폴더에는 서버를 하나만 실행하세요. 프로젝트에 설치된 실행 파일을 PowerShell에서 직접 지정할 수 있습니다.

```powershell
cd C:\bootcamp_studying_tool
.\.runtime\node.exe server.mjs
```

터미널에서 시작한 서버는 `Ctrl+C`로 종료할 수 있습니다. 다른 앱이 포트 `4173`을 사용 중이면 개발용 서버에는 다른 포트를 지정합니다.

```powershell
$env:PORT = '4174'
.\.runtime\node.exe server.mjs
```

## 커리큘럼과 수업 기록

1. 웹앱의 **자료 구성 → 커리큘럼 CSV**에서 **CSV 양식 다운로드**를 클릭합니다.
2. 실제 수업 일정과 주제를 입력하고, 같은 화면에서 **CSV 파일 선택 → 커리큘럼 업로드**를 클릭합니다.
3. **수업 진행상황**에서 수업 완료를 체크하고, 날짜별로 수업 기록을 작성합니다.
4. **홈**에서 주간 학습 활동, 과목별 진행률, 최근 수업 기록을 확인합니다. 수업을 하나 이상 완료한 날짜는 초록색 원과 체크 표시로 표시됩니다.

```csv
날짜,주제,과목,완료
2026-11-23,변수와 자료형,JavaScript,완료
2026-11-24,함수와 스코프,JavaScript,
2026-11-24,"배열, 객체 실습",JavaScript,
```

- 날짜 열과 주제 또는 과목 열이 필요합니다. `date,topic,subject,completed`처럼 영문 열 이름도 지원합니다.
- 과목별 진행률은 과목별 완료 수업 수를 전체 수업 수로 나눠 계산합니다. 과목 열이 비어 있으면 단원 이름을 사용하고, 단원도 비어 있으면 수업명으로 묶습니다.
- 날짜는 `YYYY-MM-DD` 형식을 권장합니다. 같은 날짜에 여러 수업을 등록할 수 있고, 수업 기록은 날짜당 하나입니다.
- 파일당 최대 2MB, 수업 최대 1,500개를 지원합니다. UTF-8, UTF-8 BOM, CP949, BOM이 포함된 UTF-16을 읽습니다.
- 수강일 경과율은 **오늘까지의 수업일 ÷ 전체 수업일**, 커리큘럼 완료율은 **완료한 수업 수 ÷ 전체 수업 수**입니다. 오늘은 한국 시간 기준입니다.
- 처음에는 예시 데이터가 표시됩니다. 실제 CSV를 업로드하거나 첫 수업 기록 및 자료를 저장하면 내 학습 공간으로 전환됩니다. CSV를 다시 올리면 일정이 바뀌며, 날짜·주제·단원이 일치하는 수업의 완료 상태와 날짜별 기록은 유지됩니다.

## 복습에 사용할 자료 추가하기

### GitHub

**자료 구성 → GitHub 저장소**에 `https://github.com/계정/저장소`를 입력합니다. 원하는 브랜치와 하위 폴더는 상세 항목에 지정합니다. 공개 저장소는 주소만으로 가져올 수 있습니다. 비공개 저장소는 대상 저장소의 **Contents 읽기** 권한이 있는 개인 액세스 토큰이 필요합니다. [GitHub REST API 문서](https://docs.github.com/en/rest/git/trees)

### Google Drive

**자료 구성 → Google Drive 폴더**에 폴더 주소 또는 ID를 입력합니다. Google Cloud 프로젝트에서 **Google Drive API**를 활성화하고 폴더에 맞는 연결 방법을 선택합니다.

- **링크로 공유된 폴더**는 해당 프로젝트의 Google Cloud API 키로 가져옵니다. [공개 폴더 조회 문서](https://developers.google.com/workspace/drive/api/guides/search-files#list_files_in_a_public_folder)
- **Google 계정으로 연결**은 데스크톱 앱 유형의 OAuth 클라이언트 ID와 보안 비밀번호를 입력한 뒤, Google 로그인 화면에서 읽기 권한을 승인합니다. OAuth 앱이 테스트 중이면 사용할 Google 계정을 테스트 사용자로 추가합니다. Google Docs는 텍스트, Sheets는 XLSX, Slides는 PDF로 가져옵니다. [데스크톱 앱 OAuth 문서](https://developers.google.com/identity/protocols/oauth2/native-app) · [Drive 다운로드 및 내보내기 문서](https://developers.google.com/workspace/drive/api/guides/manage-downloads)

### 추가 파일과 학습 범위

- 텍스트, 마크다운, CSV, 주요 언어의 코드와 PDF, DOCX, PPTX, XLSX를 업로드할 수 있습니다. 정리된 자료에는 파일당 8MB 제한이 적용되고, GitHub와 Drive는 가져오기 1회당 최대 24개를 읽습니다. 자료가 더 많으면 작은 하위 폴더를 골라 가져옵니다.
- `2026-11-24-배열실습.py`처럼 파일명에 날짜가 들어 있으면 앱이 그 날짜를 연결합니다. 단원 전체에 쓰는 자료는 **공통 자료**로 지정할 수 있습니다.
- 커리큘럼이 있는 경우, 날짜를 찾지 못한 자료는 **날짜 확인 필요**로 표시됩니다. 자료 목록에서 날짜 또는 공통 자료를 지정하면 생성에 포함됩니다. 커리큘럼을 올리기 전에는 날짜 미지정 자료도 전체 범위 생성에 포함됩니다.

## 문제 풀기와 요약 만들기

1. **자료 구성 → OpenAI API 설정**에서 사용할 GPT 모델을 드롭다운으로 고르고 API 키를 직접 입력해 저장합니다. **모델 목록 가져오기**를 누르면 해당 키로 조회되는 학습용 모델을 확인할 수 있습니다. [OpenAI 모델 목록 API](https://developers.openai.com/api/reference/resources/models/methods/list)
2. **복습 문제 풀이 → 문제 풀이**에서 이론, 코딩, 혼합 중 하나와 1~15개의 문제 개수를 선택합니다. 학습 범위는 오늘까지의 수업 또는 특정 수업일입니다.
3. **문제 생성하기**를 누릅니다. 답안을 제출하면 모범 답안 또는 모범 코드와 풀이를 볼 수 있습니다. 코딩테스트는 예시 입출력을 제공하며 제출한 코드는 직접 비교하는 방식입니다.
4. **요약 학습자료** 탭에서는 핵심 개념과 복습 체크리스트를 만들고 Markdown 파일로 저장할 수 있습니다. 선택한 범위의 날짜별 수업 기록은 내용의 이해나 복습에 도움이 되는 부분을 선별해 참고합니다.

생성 요청에는 선택한 범위의 커리큘럼, 기록, 참고자료가 OpenAI API로 전송됩니다. 수업에 연결한 날짜가 미래인 자료는 제외됩니다. 요청당 최대 24개의 파일과 그중 최대 3개의 문서 첨부를 참조하며, 긴 텍스트는 발췌합니다. [OpenAI 구조화 출력 문서](https://developers.openai.com/api/docs/guides/structured-outputs) · [파일 입력 문서](https://developers.openai.com/api/docs/guides/file-inputs)

## 데이터 저장과 코드 구조

커리큘럼, 수업 기록, 자료, 최근 문제 세트와 답안, 최근 요약은 프로젝트의 `.study-data/`에 저장됩니다. 보관이 필요하면 서버를 종료한 뒤 이 폴더를 복사합니다. API 키, GitHub 토큰과 Google 인증 정보는 실행 중 메모리에 저장되어 서버를 종료하면 다시 입력하거나 연결해야 합니다.

| 경로 | 역할 |
| --- | --- |
| `server.mjs` | 로컬 HTTP API, 파일 저장, Google OAuth, 요청 검증 |
| `lib/curriculum.mjs` | 커리큘럼 CSV 해석, 한국 날짜 계산, 예시 데이터 |
| `lib/sources.mjs` | GitHub·Drive 파일 가져오기 및 자료 유형 판별 |
| `lib/study.mjs` | 학습 범위 구성, OpenAI 호출, 문제·요약 응답 검증 |
| `public/` | 페이지, 차트, 입력 폼, 문제 풀이 화면 |
