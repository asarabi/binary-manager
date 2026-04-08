# Binary Retention Manager

Android 빌드 바이너리 보관 관리 도구. 원격 바이너리 서버의 디스크 사용량을 모니터링하고, 설정된 보관 정책에 따라 빌드를 자동 삭제합니다.

## 아키텍처

### Deployment View

```
Browser ──:8080──▶ nginx ──/api/*──▶ FastAPI ──▶ MySQL
                     │                  │
                     │              Retention Engine ◀── APScheduler (주기적)
                     │                  │
                     │                  └──HTTP──────▶ Disk Agent (디스크 사용량/파일 관리)
                     │
                     └── React SPA (정적 파일 서빙)
```

### 클린업 흐름

```
1. Disk Agent에 디스크 사용량 조회 ─────────────▶ 92% 응답
2. 90% 초과 → 클린업 시작
3. Disk Agent로 빌드 목록 조회 (mtime 포함)
4. score = retention_days − age_days (남은 일수) 계산
5. score 낮은 순서대로 반복:
   ├── Disk Agent DELETE (빌드 삭제)
   ├── Disk Agent로 디스크 재확인 ──────────────▶ 83% 응답
   └── 80% 이하면 중단
6. 결과를 MySQL에 저장 (cleanup_runs, cleanup_logs)
```

### 컴포넌트 역할

- **frontend 컨테이너**: nginx로 React SPA를 서빙하고 `/api/*` 요청을 backend 컨테이너로 리버스 프록시
- **backend 컨테이너**: FastAPI + uvicorn. 보관 정책 로직, 스케줄링, 정리 작업 오케스트레이션 담당
- **disk-agent 컨테이너**: FastAPI 기반 에이전트. 디스크 사용량 조회, 파일 목록/삭제를 모두 처리 (바이너리 서버에 배포)
- **MySQL**: 정리 실행 이력 및 로그 저장 (별도 컨테이너로 실행)

## 기술 스택

| 계층 | 기술 |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy (MySQL), httpx, APScheduler |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts, lucide-react |
| Disk Agent | Python 3.12, FastAPI, uvicorn |
| Infra | Docker Compose, nginx |

## 프로젝트 구조

```
docker-compose.yml               # db + backend + frontend + disk-agent (4개 서비스)
setup.sh                         # 초기 설정 스크립트

disk-agent/
  Dockerfile                     # Python 3.12 + uvicorn
  disk_agent.py                  # FastAPI 기반 디스크 사용량 에이전트
  requirements.txt               # fastapi, uvicorn

backend/
  Dockerfile                     # Python 3.12 + uvicorn
  app/
    main.py                  # FastAPI 진입점, CORS, lifespan
    config.py                # YAML 설정 로더 (Pydantic 모델)
    auth.py                  # JWT 인증 (사용자명/비밀번호, admin/user 역할)
    database.py              # MySQL 엔진 + 세션
    models.py                # SQLAlchemy 모델 (CleanupRun, CleanupLog, BuildRetentionOverride)
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
      disk_agent_service.py   # Disk Agent HTTP 클라이언트 (디스크/파일/삭제)
      scheduler_service.py   # APScheduler 주기적 디스크 점검
      cleanup_log_service.py # 정리 실행/로그 DB 작업
  tests/
    test_retention_engine.py # 보관 점수 계산 단위 테스트
  config.yaml                # 런타임 설정
  requirements.txt

frontend/
  Dockerfile                     # Node 빌드 → nginx (SPA 서빙 + API 프록시)
  nginx.conf                     # /api/ → backend:8000 프록시 + SPA fallback
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
docker compose up --build
```

http://localhost:9092 접속 → `cicd` / `tmxkqjrtm1@` (admin) 또는 `share` / `share` (user)로 로그인

종료:

```bash
docker compose down
```

### 프로덕션 모드

#### 바이너리 서버 (각 서버마다 반복)

각 바이너리 서버에 Disk Agent를 설치합니다. Disk Agent가 디스크 사용량 조회, 파일 목록, 빌드 삭제를 모두 처리합니다.

**Disk Agent 설치**

```bash
# 관리 서버에서 바이너리 서버로 disk-agent 디렉토리 복사
scp -r disk-agent/ user@binary-server:~/disk-agent

# 바이너리 서버에서 빌드 및 실행
cd ~/disk-agent
docker build -t disk-agent .
docker run -d --name disk-agent --restart unless-stopped \
  -v /data/binaries:/data/binaries \
  -e DISK_AGENT_PATH=/data/binaries \
  -p 9090:9090 \
  disk-agent
```

**동작 확인**

```bash
curl http://localhost:9090/health          # 헬스 체크
curl http://localhost:9090/disk-usage      # 디스크 사용량
curl http://localhost:9090/files/list      # 파일 목록
```

#### 관리 서버

```bash
git clone <repo-url> && cd binary-manager
```

`backend/config.yaml` 수정:

```yaml
demo_mode: false

retention:
  default_days: 7
  custom_default_days: 30
  log_retention_days: 30

binary_servers:
  - name: "custom"
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

http://localhost:9092 접속 → admin 계정으로 로그인 후 Settings 페이지에서 **연결 테스트**로 바이너리 서버 연결 확인

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
| | `disk_agent_url` | Disk Agent 엔드포인트 (디스크 사용량/파일 관리) |
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
- 보관 기간 우선순위: 빌드별 override → 프로젝트별 custom → 전역 default

### 히스테리시스 (서버별 설정)

| 임계값 | 기본값 | 동작 |
|---|---|---|
| Trigger | 90% | 디스크 사용률이 이 값을 초과하면 삭제 시작 |
| Target | 80% | 디스크 사용률이 이 값 아래로 내려가면 삭제 중단 |

각 서버마다 독립적으로 trigger/target을 설정할 수 있으며, trigger와 target 사이의 간격으로 정리 작업의 빈번한 on/off 반복을 방지합니다.

### 안전 장치

- **업로드 보호**: 최근 10분 이내 수정된 빌드는 건너뜀 (업로드 중인 빌드 보호)
- **빌드 목록 캐시**: 파일 목록 결과를 60초간 캐싱

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
| PUT | `/api/binaries/detail/{project}/{build}/retention` | 빌드별 보관 기간 설정 |
| DELETE | `/api/binaries/detail/{project}/{build}/retention` | 빌드별 보관 기간 override 제거 |
| GET | `/api/config` | 현재 설정 조회 |
| PUT | `/api/config` | 설정 수정 (admin만 가능) |
| POST | `/api/config/test-connection` | 서버 연결 테스트 (admin만 가능) |
| POST | `/api/cleanup/trigger` | 수동 정리 실행 (dry-run 지원) |
| GET | `/api/cleanup/status` | 현재 정리 작업 상태 + 실시간 로그 |
| POST | `/api/cleanup/abort` | 진행 중인 정리 작업 중단 |
| GET | `/api/logs/runs` | 정리 실행 이력 (페이지네이션) |
| GET | `/api/logs` | 정리 로그 (페이지네이션, 실행 ID 필터) |

## 개발

### 로컬 개발 (Docker 없이)

각 서비스를 별도 터미널에서 실행합니다. 코드 변경 시 자동 리로드됩니다.

```bash
# 터미널 1: 백엔드 (auto-reload)
cd backend
pip install -r requirements.txt          # 최초 1회
uvicorn app.main:app --reload --port 8000

# 터미널 2: 프론트엔드 (Vite dev server, /api → localhost:8000 자동 프록시)
cd frontend
npm install                              # 최초 1회
npm run dev                              # http://localhost:3000

# 터미널 3: disk-agent (필요 시)
cd disk-agent
pip install -r requirements.txt          # 최초 1회
python disk_agent.py --path /your/binaries --port 9090 --reload
# 또는
DISK_AGENT_PATH=/your/binaries uvicorn disk_agent:app --reload --port 9090
```

> **참고**: 프론트엔드는 Vite 프록시(`vite.config.ts`)가 `/api` 요청을 `localhost:8000`으로 전달하므로, 백엔드만 실행하면 바로 연동됩니다.

### Docker로 개발

전체 스택을 Docker로 실행하거나, 특정 서비스만 빌드/재시작할 수 있습니다.

```bash
# 전체 빌드 및 실행
docker compose up --build

# 백그라운드 실행
docker compose up --build -d

# 특정 서비스만 재빌드 (다른 서비스는 그대로)
docker compose up --build backend
docker compose up --build frontend

# 로그 확인
docker compose logs -f                   # 전체
docker compose logs -f backend           # 백엔드만
docker compose logs -f frontend          # 프론트엔드만
```

#### 서비스 구성

| 서비스 | 컨테이너 | 포트 | 설명 |
|--------|----------|------|------|
| `db` | binary-manager-db | 3306 (내부) | MySQL 8.0 |
| `backend` | binary-manager-backend | 9093 → 8000 | FastAPI + uvicorn |
| `frontend` | binary-manager-frontend | 9092 → 80 | nginx (SPA + API 프록시) |
| `disk-agent` | binary-manager-disk-agent | 9091 → 9090 | FastAPI 디스크 에이전트 |

> **접속**: http://localhost:9092 → `cicd` / `tmxkqjrtm1@` (admin) 또는 `share` / `share` (user)

#### 변경 반영 방법

| 변경 대상 | 반영 방법 |
|-----------|----------|
| `backend/app/**/*.py` | `docker compose up --build backend -d` |
| `frontend/src/**` | `docker compose up --build frontend -d` |
| `config.yaml` | `docker compose up --build backend -d` |
| `requirements.txt` | `docker compose up --build backend -d` |
| `package.json` | `docker compose up --build frontend -d` |

### 배포

```bash
docker compose up --build -d
```

### 테스트

```bash
cd backend && python -m pytest tests/ -v
```

### Docker 주요 명령어

```bash
docker compose up --build -d    # 전체 빌드 및 시작
docker compose down             # 중지 및 제거
docker compose ps               # 컨테이너 상태 확인
docker compose logs -f backend  # 백엔드 로그 실시간 확인
```

## UI 페이지

| 페이지 | 설명 |
|---|---|
| **Login** | 사용자명/비밀번호 인증 (admin/user 역할 구분) |
| **Dashboard** | 서버별 디스크 사용량 게이지, 프로젝트/빌드 통계, 수동 정리 실행 (dry-run/실행 로그/중단 지원) |
| **Binaries** | All/서버별 탭으로 프로젝트 목록 조회; 빌드별 남은 일수, 만료 상태, 개별 보관 기간 설정 |
| **Settings** | 서버 관리, custom project별 보관 기간, 로그 보관 기간 설정, 연결 테스트 (admin 전용) |
| **Logs** | 정리 실행 이력, 서버별 그룹핑된 상세 로그 |
