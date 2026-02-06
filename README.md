# Binary Retention Manager

Android 빌드 바이너리 보관 관리 도구. 원격 바이너리 서버의 디스크 사용량을 모니터링하고, 설정된 보관 정책에 따라 빌드를 자동 삭제합니다.

## 아키텍처

```
Browser → nginx(:8080) → React SPA
                       → /api/* proxy → FastAPI(:8000) → MySQL(:3306)
                                                       → SSH → Binary Server (디스크 작업)
                                                       → WebDAV → Binary Server (파일 목록)
```

- **nginx**: React SPA를 서빙하고 `/api/*` 요청을 FastAPI 백엔드로 리버스 프록시
- **FastAPI**: 보관 정책 로직, 스케줄링, 정리 작업 오케스트레이션 담당
- **SSH**: 바이너리 서버의 디스크 사용량 확인 및 파일 삭제에 사용
- **WebDAV**: 바이너리 서버의 빌드 목록 조회에 사용
- **MySQL**: 정리 실행 이력 및 로그 저장 (별도 컨테이너로 실행)

## 기술 스택

| 계층 | 기술 |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy (MySQL), paramiko (SSH), webdavclient3, APScheduler |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts, lucide-react |
| Infra | Docker Compose, nginx |

## 프로젝트 구조

```
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
      ssh_service.py         # SSH 연결 및 디스크 작업
      webdav_service.py      # WebDAV 파일 목록 (캐싱 포함)
      scheduler_service.py   # APScheduler 주기적 디스크 점검
      cleanup_log_service.py # 정리 실행/로그 DB 작업
  tests/
    test_retention_engine.py # 보관 점수 계산 단위 테스트
  config.yaml                # 런타임 설정
  requirements.txt
  Dockerfile

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
  Dockerfile

docker-compose.yml
```

## 빠른 시작

### 초기 설정

최초 실행 전 설정 파일과 DB를 초기화합니다:

```bash
./setup.sh
```

이 스크립트는 `~/binary-manager-backup/` 폴더에 다음을 생성합니다:
- `config.yaml` - 런타임 설정 (소스의 기본 설정 복사)
- `mysql/` - MySQL 데이터 디렉토리

MySQL DB는 첫 실행 시 자동으로 초기화되며, 이미 파일이 존재하면 덮어쓰지 않아 기존 데이터가 보존됩니다.

### 데모 모드 (기본값)

데모 모드는 실제 바이너리 서버 없이 UI를 탐색할 수 있도록 가짜 데이터를 생성합니다.

```bash
docker compose up --build
```

http://localhost:8080 접속 후 비밀번호 `changeme`로 로그인합니다.

### 프로덕션 모드

1. `backend/config.yaml` 수정:

```yaml
demo_mode: false

binary_server:
  webdav_url: "http://your-binary-server:8080"
  ssh_host: "your-binary-server"
  ssh_port: 22
  ssh_username: "binmanager"
  ssh_key_path: "/home/app/.ssh/id_rsa"
  binary_root_path: "/data/binaries"

auth:
  shared_password: "your-secure-password"
  jwt_secret: "your-random-secret"
```

2. SSH 키를 마운트하여 시작:

```bash
SSH_KEY_PATH=/path/to/your/ssh/key docker compose up -d
```

## 설정

`backend/config.yaml`로 모든 런타임 동작을 제어합니다:

| 섹션 | 키 | 설명 |
|---|---|---|
| `demo_mode` | `true/false` | UI 테스트용 가짜 데이터 활성화 |
| `binary_server` | `webdav_url` | 파일 목록 조회용 WebDAV 엔드포인트 |
| | `ssh_host`, `ssh_port`, `ssh_username`, `ssh_key_path` | 디스크 작업용 SSH 자격 증명 |
| | `binary_root_path` | 서버상 바이너리 루트 디렉토리 |
| `disk` | `trigger_threshold_percent` | 정리 시작 디스크 사용률 (기본값: 90) |
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

### 히스테리시스

| 임계값 | 값 | 동작 |
|---|---|---|
| Trigger | 90% | 디스크 사용률이 이 값을 초과하면 삭제 시작 |
| Target | 80% | 디스크 사용률이 이 값 아래로 내려가면 삭제 중단 |

trigger와 target 사이의 간격으로 정리 작업의 빈번한 on/off 반복을 방지합니다.

### 안전 장치

- **Rsync 보호**: 최근 10분 이내 수정된 빌드는 건너뜀 (업로드 중인 빌드 보호)
- **WebDAV 캐시**: 파일 목록 결과를 60초간 캐싱
- **SSH 풀링**: 바이너리 서버에 단일 영구 SSH 연결 유지

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
| POST | `/api/cleanup/trigger` | 수동 정리 실행 (dry-run 지원) |
| GET | `/api/cleanup/status` | 현재 정리 작업 상태 조회 |
| GET | `/api/logs/runs` | 정리 실행 이력 (페이지네이션) |
| GET | `/api/logs` | 정리 로그 (페이지네이션, 실행 ID 필터) |

## 개발

### Backend

```bash
pip install -r backend/requirements.txt

# 테스트 실행
cd backend && python -m pytest tests/ -v

# 개발 서버 실행
cd backend && uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend && npm install

# 개발 서버 실행 (/api를 localhost:8000으로 프록시)
cd frontend && npm run dev

# 프로덕션 빌드
cd frontend && npm run build
```

### Docker

```bash
docker compose up --build       # 빌드 후 시작
docker compose up -d            # 백그라운드 모드
docker compose down             # 중지 및 제거
```

## UI 페이지

| 페이지 | 설명 |
|---|---|
| **Login** | 공유 비밀번호 인증 |
| **Dashboard** | 디스크 사용량 게이지, 프로젝트/빌드 통계, 수동 정리 실행 (dry-run 옵션 포함) |
| **Binaries** | 보관 유형 및 빌드 수가 포함된 프로젝트 테이블; 개별 빌드의 점수 및 만료일 확인 |
| **Settings** | 디스크 임계값, 점검 주기, 보관 유형, 프로젝트 매핑 편집 |
| **Logs** | 정리 실행 이력 및 실행별 상세 로그 |
