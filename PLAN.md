# Binary Retention Manager - 구현 계획

## 개요
바이너리 서버의 안드로이드 빌드 바이너리를 관리하는 웹 애플리케이션.
디스크 사용량 모니터링, 보관 정책 기반 자동 삭제, 웹 UI 대시보드 제공.

## 아키텍처
- **Backend**: Python FastAPI (관리 서버에서 실행)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **Disk Agent**: FastAPI 기반 에이전트 (바이너리 서버에서 실행) — 디스크 사용량, 파일 목록/삭제 처리
- **DB**: MySQL (삭제 이력 로그)
- **인증**: 사용자명/비밀번호 → JWT 토큰 (admin/user 역할)

## 디렉터리 구조 (바이너리 서버)
```
/data/binaries/
  project-name/
    B00001/
      *.apk, *.aab, etc.
    B00002/
      ...
```

## 핵심 삭제 알고리즘

1. Disk Agent에 디스크 사용량 조회
2. 사용률 >= 90% 이면 정리 시작
3. Disk Agent로 전체 빌드 목록 수집 (프로젝트명, 빌드번호, 수정일)
4. 각 빌드에 삭제 점수 부여:
   - `score = retention_days - age_days` (남은 일수)
   - 점수가 낮을수록 먼저 삭제 (만료된 빌드가 음수이므로 우선 삭제)
   - Custom project는 더 긴 retention_days를 가져 보호됨
5. 점수 오름차순으로 빌드 삭제, 매 삭제 후 디스크 재확인
6. 사용률 <= 80% 도달 시 중단 (히스테리시스)

## 설정 파일 형식 (`backend/config.yaml`)

```yaml
demo_mode: false

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

retention:
  default_days: 7
  custom_default_days: 30
  log_retention_days: 30

auth:
  users:
    - username: "admin"
      password: "your-password"
      role: "admin"
    - username: "viewer"
      password: "viewer-password"
      role: "user"
  jwt_secret: "generated-secret"
```

## 프로젝트 구조

```
binary-manager/
├── docker-compose.yml               # db + backend + frontend + disk-agent (4 서비스)
├── setup.sh                         # 초기 설정 스크립트
├── disk-agent/
│   ├── Dockerfile                   # Python 3.12 + uvicorn
│   ├── disk_agent.py                # FastAPI: 디스크 사용량, 파일 목록/삭제
│   └── requirements.txt             # fastapi, uvicorn
├── backend/
│   ├── Dockerfile                   # Python 3.12 + uvicorn
│   ├── app/
│   │   ├── main.py                  # FastAPI 진입점, CORS, lifespan
│   │   ├── config.py                # YAML 설정 로더 (Pydantic)
│   │   ├── auth.py                  # JWT 인증 (username/password, admin/user 역할)
│   │   ├── database.py              # MySQL 엔진 + 세션
│   │   ├── models.py                # CleanupRun, CleanupLog 모델
│   │   ├── schemas.py               # API 요청/응답 스키마
│   │   ├── routers/
│   │   │   ├── auth_router.py       # POST /api/auth/login
│   │   │   ├── dashboard_router.py  # GET /api/dashboard/stats
│   │   │   ├── binaries_router.py   # GET /api/binaries, DELETE
│   │   │   ├── config_router.py     # GET/PUT /api/config
│   │   │   ├── cleanup_router.py    # POST /api/cleanup/trigger
│   │   │   └── logs_router.py       # GET /api/logs
│   │   └── services/
│   │       ├── disk_agent_service.py  # Disk Agent HTTP 클라이언트
│   │       ├── retention_engine.py    # 정리 알고리즘 핵심 로직
│   │       ├── scheduler_service.py   # APScheduler 주기적 체크
│   │       └── cleanup_log_service.py # 정리 로그 DB 작업
│   ├── config.yaml
│   ├── requirements.txt
│   └── tests/
├── frontend/
│   ├── Dockerfile                   # Node 빌드 → nginx (SPA + API 프록시)
│   ├── nginx.conf                   # /api/ → backend:8000 프록시 + SPA fallback
│   ├── src/
│   │   ├── api/client.ts            # Axios 클라이언트 (JWT 인터셉터)
│   │   ├── context/AuthContext.tsx   # 인증 상태 관리
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx    # 디스크 게이지, 통계 카드
│   │   │   ├── BinaryListPage.tsx   # 프로젝트/빌드 테이블
│   │   │   ├── ProjectDetailPage.tsx # 프로젝트별 빌드 목록
│   │   │   ├── SettingsPage.tsx     # 서버/보관 정책 편집
│   │   │   └── LogsPage.tsx         # 삭제 이력
│   │   └── components/
│   │       ├── Layout.tsx, Sidebar.tsx
│   │       ├── DiskUsageGauge.tsx
│   │       ├── ProjectTable.tsx
│   │       └── RetentionBadge.tsx
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/login` | 사용자명/비밀번호 → JWT 토큰 + 역할 |
| GET | `/api/dashboard/stats` | 서버별 디스크 사용량, 프로젝트/빌드 수 |
| GET | `/api/binaries` | 전체 프로젝트 목록 (보관 정보, 서버 필터) |
| GET | `/api/binaries/detail/{project}` | 프로젝트 내 빌드 목록 (남은 일수 포함) |
| DELETE | `/api/binaries/detail/{project}/{build}` | 특정 빌드 수동 삭제 |
| GET | `/api/config` | 현재 설정 조회 |
| PUT | `/api/config` | 설정 수정 (admin 전용) |
| POST | `/api/config/test-connection` | 서버 연결 테스트 (admin 전용) |
| POST | `/api/cleanup/trigger` | 수동 정리 실행 (dry_run 지원) |
| GET | `/api/cleanup/status` | 정리 진행 상태 |
| GET | `/api/logs/runs` | 정리 실행 이력 (페이지네이션) |
| GET | `/api/logs` | 삭제 상세 이력 (페이지네이션) |
| GET | `/api/health` | 헬스 체크 |

## 주요 의존성

**Backend**: fastapi, uvicorn, python-jose, pyyaml, httpx, apscheduler, sqlalchemy, pymysql
**Frontend**: react, react-router-dom, axios, recharts, tailwindcss, lucide-react
**Disk Agent**: fastapi, uvicorn

## 구현 순서

### Phase 1: 백엔드 기반 (config, auth, DB)
1. 프로젝트 스캐폴딩 (디렉터리, requirements.txt, package.json)
2. `config.py` + `config.yaml`
3. `database.py` + `models.py`
4. `auth.py` + `auth_router.py`

### Phase 2: Disk Agent + 서버 연동
5. `disk_agent.py` (디스크 사용량, 파일 목록/삭제 API)
6. `disk_agent_service.py` (Backend → Disk Agent HTTP 클라이언트)
7. `dashboard_router.py` + `binaries_router.py`

### Phase 3: 정리 엔진
8. `retention_engine.py` (점수 산정, 삭제 로직)
9. `cleanup_log_service.py`
10. `cleanup_router.py` + `scheduler_service.py`
11. `logs_router.py` + `config_router.py`

### Phase 4: 프론트엔드
12. Vite + React + TypeScript + Tailwind 초기 설정
13. API 클라이언트 + AuthContext
14. LoginPage
15. Layout + Sidebar
16. DashboardPage (디스크 게이지, 통계 카드, 정리 버튼)
17. BinaryListPage + ProjectDetailPage
18. SettingsPage (서버 관리, 보관 정책 편집)
19. LogsPage

### Phase 5: 배포
20. Dockerfile (backend, frontend, disk-agent 각각)
21. docker-compose.yml (db + backend + frontend + disk-agent)

## 검증 방법

1. **단위 테스트**: `retention_engine.py`의 점수 산정 및 삭제 순서 테스트
2. **수동 테스트**:
   - 웹 UI 로그인 → 대시보드 확인
   - 바이너리 목록 조회, 프로젝트별 빌드 확인
   - dry_run으로 정리 시뮬레이션 실행
   - 설정 변경 후 저장 및 반영 확인
3. **Docker**: `docker compose up --build`로 전체 스택 실행 확인

## 주의사항

- 업로드 중인 빌드 보호: 수정일이 10분 이내인 빌드는 삭제 건너뜀
- 빌드 목록 캐싱 (TTL 60초)
- 시간대: 모든 타임스탬프 UTC 기준 처리
