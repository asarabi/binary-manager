# Binary Retention Manager

Android 빌드 바이너리 보관 관리 도구. 원격 바이너리 서버의 디스크 사용량을 모니터링하고, 설정된 보관 정책에 따라 빌드를 자동 삭제합니다.

## 아키텍처

### Deployment View

```
Browser ──:8080──▶ nginx ──/api/*──▶ FastAPI ──▶ MySQL
                     │                  │
                     │              Retention Engine ◀── APScheduler (주기적)
                     │                  │
                     │                  ├──WebDAV────▶ 바이너리 서버 (목록/삭제)
                     │                  └──HTTP──────▶ Disk Agent   (디스크 사용량)
                     │
                     └── React SPA (정적 파일 서빙)
```

### 클린업 흐름

```
1. Disk Agent에 디스크 사용량 조회 ─────────────▶ 92% 응답
2. 90% 초과 → 클린업 시작
3. WebDAV로 빌드 목록 조회 (mtime 포함)
4. score = retention_days − age_days (남은 일수) 계산
5. score 낮은 순서대로 반복:
   ├── WebDAV DELETE (빌드 삭제)
   ├── Disk Agent로 디스크 재확인 ──────────────▶ 83% 응답
   └── 80% 이하면 중단
6. 결과를 MySQL에 저장 (cleanup_runs, cleanup_logs)
```

### 컴포넌트 역할

- **app 컨테이너**: nginx + uvicorn을 supervisord로 단일 컨테이너에서 실행
  - **nginx**: React SPA를 서빙하고 `/api/*` 요청을 로컬 uvicorn으로 리버스 프록시
  - **FastAPI**: 보관 정책 로직, 스케줄링, 정리 작업 오케스트레이션 담당
- **WebDAV**: 바이너리 서버의 빌드 목록 조회 및 삭제에 사용
- **Disk Agent**: 바이너리 서버에 설치하는 경량 HTTP 에이전트 (디스크 사용량/디렉토리 크기 조회)
- **MySQL**: 정리 실행 이력 및 로그 저장 (별도 컨테이너로 실행)

## 기술 스택

| 계층 | 기술 |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy (MySQL), webdavclient3, httpx, APScheduler |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts, lucide-react |
| Infra | Docker Compose, nginx, supervisord |

## 프로젝트 구조

```
Dockerfile                       # 멀티스테이지 빌드 (프론트엔드 빌드 + Python/nginx/supervisord)
nginx.conf                       # 리버스 프록시 (/api/ → localhost:8000) + SPA 서빙
supervisord.conf                 # 단일 컨테이너에서 uvicorn + nginx 실행
docker-compose.yml               # db + app (2개 서비스)
setup.sh                         # 초기 설정 스크립트

disk-agent/
  disk_agent.py                  # 바이너리 서버용 디스크 사용량 HTTP 에이전트 (stdlib only)

backend/
  app/
    main.py                  # FastAPI 진입점, CORS, lifespan
    config.py                # YAML 설정 로더 (Pydantic 모델)
    auth.py                  # JWT 인증 (사용자명/비밀번호, admin/user 역할)
    database.py              # MySQL 엔진 + 세션
    models.py                # SQLAlchemy 모델 (CleanupRun, CleanupLog)
    schemas.py               # Pydantic 요청/응답 스키마
    routers/
      auth_router.py         # 로그인 엔드포인트
      dashboard_router.py    # 대시보드 통계
      binaries_router.py     # 바이너리 목록 조회 및 삭제
      config_router.py       # 설정 조회/수정
      cleanup_router.py      # 수동 정리 실행 및 상태 조회
      logs_router.py         # 정리 실행/로그 이력
    services/
      retention_engine.py    # 보관 점수 계산 및 정리 로직
      webdav_service.py      # WebDAV 파일 목록/삭제 (캐싱 포함)
      disk_agent_service.py  # Disk Agent HTTP 클라이언트 (디스크 사용량/크기)
      scheduler_service.py   # APScheduler 주기적 디스크 점검
      cleanup_log_service.py # 정리 실행/로그 DB 작업
  tests/
    test_retention_engine.py # 보관 점수 계산 단위 테스트
  config.yaml                # 런타임 설정
  requirements.txt

frontend/
  src/
    api/client.ts            # Axios 인스턴스 (JWT 인터셉터)
    context/AuthContext.tsx   # 인증 상태 관리
    components/
      Layout.tsx             # 사이드바 포함 앱 셸
      Sidebar.tsx            # 네비게이션 사이드바
      DiskUsageGauge.tsx     # 디스크 사용량 원형 게이지
      ProjectTable.tsx       # 프로젝트 목록 테이블
      RetentionBadge.tsx     # 보관 유형 뱃지
    pages/
      LoginPage.tsx          # 로그인 폼
      DashboardPage.tsx      # 디스크 사용량 통계 및 정리 제어
      BinaryListPage.tsx     # 보관 정보 포함 프로젝트 목록
      ProjectDetailPage.tsx  # 프로젝트별 빌드 목록
      SettingsPage.tsx       # 설정 편집기
      LogsPage.tsx           # 정리 이력 뷰어
```

## 설치 가이드

### 데모 vs 프로덕션 비교

| | 데모 모드 | 프로덕션 모드 |
|---|---|---|
| 용도 | UI 탐색 및 기능 확인 | 실제 바이너리 관리 |
| 바이너리 서버 | 불필요 | 필요 (N대) |
| 데이터 | 가짜 데이터 자동 생성 | 실제 서버에서 조회 |
| 클린업 | 실제 삭제 안 됨 | 실제 빌드 삭제됨 |
| config.yaml | `demo_mode: true` (기본값) | `demo_mode: false` + 서버 정보 입력 |
| 설치 절차 | 관리 서버만 설정 | 바이너리 서버 설정 → 관리 서버 설정 |

### 데모 모드 (관리 서버만)

```bash
git clone <repo-url> && cd binary-manager
./setup.sh
docker compose up --build
```

http://localhost:8080 접속 → `cicd` / `tmxkqjrtm1@` (admin) 또는 `share` / `share` (user)로 로그인

종료:

```bash
docker compose down
```

### 프로덕션 모드

#### 바이너리 서버 (각 서버마다 반복)

각 바이너리 서버에 WebDAV와 Disk Agent를 설치합니다.

**1) WebDAV** — 빌드 목록 조회 및 삭제용

```bash
sudo apt install nginx nginx-extras
```

`/etc/nginx/sites-available/webdav` 작성:

```nginx
server {
    listen 8080;
    root /data/binaries;

    location / {
        dav_methods PUT DELETE MKCOL COPY MOVE;
        dav_ext_methods PROPFIND OPTIONS;
        autoindex on;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/webdav /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

**2) Disk Agent** — 디스크 사용량 조회용 (Python 표준 라이브러리만 사용)

```bash
# 관리 서버에서 바이너리 서버로 파일 복사
scp disk-agent/disk_agent.py disk-agent/disk-agent.service user@binary-server:~/

# 바이너리 서버에서 설치
sudo mkdir -p /opt/disk-agent
sudo cp ~/disk_agent.py /opt/disk-agent/
sudo cp ~/disk-agent.service /etc/systemd/system/

# 필요 시 --path, --port 수정
sudo vi /etc/systemd/system/disk-agent.service

# 서비스 등록 및 시작
sudo systemctl enable --now disk-agent
```

**3) 동작 확인**

```bash
curl http://localhost:9090/health          # Disk Agent
curl http://localhost:9090/disk-usage      # 디스크 사용량
curl -X PROPFIND http://localhost:8080/    # WebDAV
```

#### 관리 서버

```bash
git clone <repo-url> && cd binary-manager
./setup.sh
```

`~/binary-manager-backup/config.yaml` 수정:

```yaml
demo_mode: false

retention:
  default_days: 7
  custom_default_days: 30
  log_retention_days: 30

binary_servers:
  - name: "custom"
    webdav_url: "http://custom-server:8080"
    disk_agent_url: "http://custom-server:9090"
    binary_root_path: "/data/binaries"
    project_depth: 2
    trigger_threshold_percent: 90
    target_threshold_percent: 80
    check_interval_minutes: 5
    custom_projects:
      - path: "automotive/release"
        retention_days: 90

auth:
  users:
    - username: "admin"
      password: "your-secure-password"
      role: "admin"
    - username: "viewer"
      password: "viewer-password"
      role: "user"
  jwt_secret: "your-random-secret"
```

```bash
docker compose up --build -d
```

http://localhost:8080 접속 → admin 계정으로 로그인 후 Settings 페이지에서 **연결 테스트**로 바이너리 서버 연결 확인

종료:

```bash
docker compose down
```

## 설정

`backend/config.yaml`로 모든 런타임 동작을 제어합니다:

| 섹션 | 키 | 설명 |
|---|---|---|
| `demo_mode` | `true/false` | UI 테스트용 가짜 데이터 활성화 |
| `binary_servers[]` | `name` | 서버 식별 이름 |
| | `webdav_url` | 파일 목록 조회/삭제용 WebDAV 엔드포인트 |
| | `disk_agent_url` | 디스크 사용량 조회용 Disk Agent 엔드포인트 |
| | `binary_root_path` | 서버상 바이너리 루트 디렉토리 |
| | `project_depth` | 프로젝트 디렉토리 깊이 (기본값: 1) |
| | `trigger_threshold_percent` | 정리 시작 디스크 사용률 (기본값: 90) |
| | `target_threshold_percent` | 정리 중단 디스크 사용률 (기본값: 80) |
| | `check_interval_minutes` | 디스크 사용량 점검 주기 (기본값: 5분) |
| | `custom_projects[]` | 프로젝트별 보관 기간 재정의 (`path`, `retention_days`) |
| `retention` | `default_days` | 기본 보관 기간 (기본값: 7일) |
| | `custom_default_days` | Custom project 추가 시 기본값 (기본값: 30일) |
| | `log_retention_days` | 클린업 로그 보관 기간 (기본값: 30일) |
| `auth` | `users[]` | 계정 목록 (`username`, `password`, `role`: admin/user) |
| | `jwt_secret` | JWT 서명 키 |

## 보관 알고리즘

### 점수 공식

```
score = retention_days - age_days  (남은 일수)
```

- **낮은 점수 = 먼저 삭제**
- 만료된 빌드는 score가 음수이므로 우선 삭제됨
- 동일 보관 기간 내에서 오래된 빌드가 먼저 삭제됨
- Custom project는 더 긴 retention_days를 가질 수 있어 보호됨

### 히스테리시스 (서버별 설정)

| 임계값 | 기본값 | 동작 |
|---|---|---|
| Trigger | 90% | 디스크 사용률이 이 값을 초과하면 삭제 시작 |
| Target | 80% | 디스크 사용률이 이 값 아래로 내려가면 삭제 중단 |

각 서버마다 독립적으로 trigger/target을 설정할 수 있으며, trigger와 target 사이의 간격으로 정리 작업의 빈번한 on/off 반복을 방지합니다.

### 안전 장치

- **업로드 보호**: 최근 10분 이내 수정된 빌드는 건너뜀 (업로드 중인 빌드 보호)
- **WebDAV 캐시**: 파일 목록 결과를 60초간 캐싱

## API 엔드포인트

health와 login을 제외한 모든 엔드포인트는 `Authorization: Bearer <token>` 헤더를 통한 JWT 인증이 필요합니다.

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 헬스 체크 |
| POST | `/api/auth/login` | 사용자명/비밀번호 로그인, JWT 토큰 + 역할 반환 |
| GET | `/api/dashboard/stats` | 서버별 디스크 사용량, 프로젝트/빌드 수, 정리 상태 |
| GET | `/api/binaries` | 보관 정보 포함 전체 프로젝트 목록 (server 필터 지원) |
| GET | `/api/binaries/detail/{project}` | 프로젝트별 빌드 목록 (남은 일수 포함) |
| DELETE | `/api/binaries/detail/{project}/{build}` | 특정 빌드 삭제 |
| GET | `/api/config` | 현재 설정 조회 |
| PUT | `/api/config` | 설정 수정 (admin만 가능) |
| POST | `/api/config/test-connection` | 서버 연결 테스트 (admin만 가능) |
| POST | `/api/cleanup/trigger` | 수동 정리 실행 (dry-run 지원) |
| GET | `/api/cleanup/status` | 현재 정리 작업 상태 조회 |
| GET | `/api/logs/runs` | 정리 실행 이력 (페이지네이션) |
| GET | `/api/logs` | 정리 로그 (페이지네이션, 실행 ID 필터) |

## 개발

### 개발 모드

로컬에서 백엔드와 프론트엔드를 각각 실행하여 개발합니다:

```bash
# 백엔드 (터미널 1)
cd backend && uvicorn app.main:app --reload --port 8000

# 프론트엔드 (터미널 2)
cd frontend && npm run dev
```

### 배포

확인이 완료되면 Docker 이미지로 빌드하여 배포합니다:

```bash
# 최초 1회
./setup.sh

# 빌드 및 실행
docker compose up --build -d

# 로그 확인
docker compose logs -f app
```

http://localhost:8080 접속 → `cicd` / `tmxkqjrtm1@` (admin) 또는 `share` / `share` (user)로 로그인

| 변경 대상 | 반영 방식 |
|-----------|----------|
| `backend/app/**/*.py` | `docker compose up --build -d` |
| `frontend/src/**` | `docker compose up --build -d` |
| `config.yaml` | `docker compose restart app` |
| `requirements.txt` / `package.json` | `docker compose up --build -d` |

### 테스트

```bash
cd backend && python -m pytest tests/ -v
```

### Docker 명령어

```bash
docker compose up --build -d    # 빌드 및 시작
docker compose down             # 중지 및 제거
docker compose ps               # 컨테이너 상태 확인
docker compose logs -f app      # 앱 로그 실시간 확인
```

## UI 페이지

| 페이지 | 설명 |
|---|---|
| **Login** | 사용자명/비밀번호 인증 (admin/user 역할 구분) |
| **Dashboard** | 서버별 디스크 사용량 게이지, 프로젝트/빌드 통계, 수동 정리 실행 (dry-run 포함) |
| **Binaries** | All/서버별 탭으로 프로젝트 목록 조회; 빌드별 남은 일수 및 만료 상태 확인 |
| **Settings** | 서버 관리, custom project별 보관 기간, 로그 보관 기간 설정, 연결 테스트 (admin 전용) |
| **Logs** | 정리 실행 이력, 서버별 그룹핑된 상세 로그 |
