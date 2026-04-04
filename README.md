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
4. score = priority × 1000 + remaining_days × 10 계산
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
    auth.py                  # JWT 인증 (공유 비밀번호)
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

이 시스템은 **관리 서버** 1대와 **바이너리 서버** N대로 구성됩니다.

```
┌─────────────────┐         ┌─────────────────────┐
│   관리 서버       │ ──────▶ │  바이너리 서버 (N대)   │
│                 │  HTTP   │                     │
│  Docker 컨테이너  │         │  WebDAV  :8080      │
│  ├ App  :8080   │         │  Disk Agent :9090   │
│  └ MySQL :3306  │         │  /data/binaries/    │
└─────────────────┘         └─────────────────────┘
```

### 1단계: 바이너리 서버 설정 (각 서버마다 반복)

바이너리 서버에는 **WebDAV**와 **Disk Agent** 두 가지를 설치합니다.

#### WebDAV 설치

빌드 파일의 목록 조회와 삭제를 위해 WebDAV를 설치합니다. 아래는 nginx 기반 예시입니다:

```bash
# nginx + WebDAV 모듈 설치
sudo apt install nginx nginx-extras

# nginx 설정 (/etc/nginx/sites-available/webdav)
server {
    listen 8080;
    root /data/binaries;

    location / {
        dav_methods PUT DELETE MKCOL COPY MOVE;
        dav_ext_methods PROPFIND OPTIONS;
        autoindex on;
    }
}

sudo ln -s /etc/nginx/sites-available/webdav /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

#### Disk Agent 설치

디스크 사용량 조회를 위한 경량 HTTP 에이전트입니다. Python 표준 라이브러리만 사용하므로 별도 패키지 설치가 필요 없습니다.

```bash
# disk_agent.py를 바이너리 서버로 복사
scp disk-agent/disk_agent.py user@binary-server:~/

# 바이너리 서버에서 실행
python3 disk_agent.py --path /data/binaries --port 9090
```

systemd 서비스로 등록하면 서버 재시작 시 자동 실행됩니다. 서비스 파일은 `disk-agent/disk-agent.service`에 포함되어 있습니다:

```bash
# 파일 복사
sudo mkdir -p /opt/disk-agent
sudo cp disk_agent.py /opt/disk-agent/
sudo cp disk-agent.service /etc/systemd/system/

# 필요 시 ExecStart의 --path, --port 값을 환경에 맞게 수정
sudo vi /etc/systemd/system/disk-agent.service

# 서비스 등록 및 시작
sudo systemctl enable --now disk-agent
```

#### 동작 확인

```bash
# Disk Agent 확인
curl http://localhost:9090/health
curl http://localhost:9090/disk-usage

# WebDAV 확인
curl -X PROPFIND http://localhost:8080/
```

### 2단계: 관리 서버 설정

관리 서버에서 Docker Compose로 앱과 DB를 실행합니다.

```bash
# 소스 클론
git clone <repo-url> && cd binary-manager

# 초기 설정 (~/binary-manager-backup/ 에 config.yaml과 mysql/ 생성)
./setup.sh
```

#### 설정 파일 수정

`~/binary-manager-backup/config.yaml`을 열어 바이너리 서버 정보를 입력합니다:

```yaml
demo_mode: false    # 반드시 false로 변경

binary_servers:
  - name: "custom"
    webdav_url: "http://custom-server:8080"       # 바이너리 서버의 WebDAV 주소
    disk_agent_url: "http://custom-server:9090"   # 바이너리 서버의 Disk Agent 주소
    binary_root_path: "/data/binaries"            # 바이너리 서버의 빌드 저장 경로
    trigger_threshold_percent: 90                 # 이 사용률 초과 시 정리 시작
    target_threshold_percent: 80                  # 이 사용률 이하로 내려가면 정리 중단
    check_interval_minutes: 5                     # 디스크 점검 주기
  - name: "mobile"
    webdav_url: "http://mobile-server:8080"
    disk_agent_url: "http://mobile-server:9090"
    binary_root_path: "/data/binaries"
    trigger_threshold_percent: 90
    target_threshold_percent: 80
    check_interval_minutes: 5

auth:
  shared_password: "your-secure-password"   # 웹 UI 로그인 비밀번호
  jwt_secret: "your-random-secret"          # JWT 서명 키 (랜덤 문자열)
```

#### 실행

```bash
docker compose up --build -d
```

http://localhost:8080 접속 → 설정한 비밀번호로 로그인

#### 연결 확인

Settings 페이지에서 **연결 테스트** 버튼을 클릭하여 각 바이너리 서버와의 WebDAV/Disk Agent 연결을 확인합니다.

### 데모 모드 (바이너리 서버 없이 테스트)

바이너리 서버 없이 UI를 먼저 확인하고 싶다면 데모 모드로 실행합니다:

```bash
./setup.sh
docker compose up --build
```

`config.yaml`의 `demo_mode: true` (기본값)로 가짜 데이터가 생성됩니다.
http://localhost:8080 접속 후 비밀번호 `changeme`로 로그인합니다.

## 설정

`backend/config.yaml`로 모든 런타임 동작을 제어합니다:

| 섹션 | 키 | 설명 |
|---|---|---|
| `demo_mode` | `true/false` | UI 테스트용 가짜 데이터 활성화 |
| `binary_servers[]` | `name` | 서버 식별 이름 |
| | `webdav_url` | 파일 목록 조회/삭제용 WebDAV 엔드포인트 |
| | `disk_agent_url` | 디스크 사용량 조회용 Disk Agent 엔드포인트 |
| | `binary_root_path` | 서버상 바이너리 루트 디렉토리 |
| | `trigger_threshold_percent` | 정리 시작 디스크 사용률 (기본값: 90) |
| | `target_threshold_percent` | 정리 중단 디스크 사용률 (기본값: 80) |
| | `check_interval_minutes` | 디스크 사용량 점검 주기 (기본값: 5분) |
| `retention_types` | `name`, `retention_days`, `priority` | 이름별 보관 정책 |
| `project_mappings` | `pattern`, `type` | glob 패턴 → 보관 유형 매핑 |
| `auth` | `shared_password`, `jwt_secret` | 인증 자격 증명 |

## 보관 알고리즘

### 점수 공식

```
score = priority * 1000 + remaining_days * 10
```

- **낮은 점수 = 먼저 삭제**
- `priority`로 빌드 유형별 그룹화 (예: nightly=1, release=3)
- 동일 priority 내에서 만료일에 가까운 빌드가 먼저 삭제됨
- 만료된 빌드는 `remaining_days`가 음수이므로 점수가 더 낮아짐

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
| POST | `/api/auth/login` | 비밀번호로 로그인, JWT 토큰 반환 |
| GET | `/api/dashboard/stats` | 디스크 사용량, 프로젝트/빌드 수, 정리 상태 |
| GET | `/api/binaries` | 보관 정보 포함 전체 프로젝트 목록 |
| GET | `/api/binaries/{project}` | 프로젝트별 빌드 목록 (점수 포함) |
| DELETE | `/api/binaries/{project}/{build}` | 특정 빌드 삭제 |
| GET | `/api/config` | 현재 설정 조회 |
| PUT | `/api/config` | 설정 수정 |
| POST | `/api/config/test-connection` | 서버 연결 테스트 (WebDAV + Disk Agent) |
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

http://localhost:8080 접속 → 비밀번호 `changeme`로 로그인

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
| **Login** | 공유 비밀번호 인증 |
| **Dashboard** | 디스크 사용량 게이지, 프로젝트/빌드 통계, 수동 정리 실행 (dry-run 옵션 포함) |
| **Binaries** | 보관 유형 및 빌드 수가 포함된 프로젝트 테이블; 개별 빌드의 점수 및 만료일 확인 |
| **Settings** | 서버 관리 (WebDAV/Agent URL, 디스크 임계값), 보관 유형, 프로젝트 매핑 편집, 연결 테스트 |
| **Logs** | 정리 실행 이력 및 실행별 상세 로그 |
