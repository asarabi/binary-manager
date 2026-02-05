# Binary Retention Manager - 구현 계획

## 개요
바이너리 서버의 안드로이드 빌드 바이너리를 관리하는 웹 애플리케이션.
디스크 사용량 모니터링, 보관 정책 기반 자동 삭제, 웹 UI 대시보드 제공.

## 아키텍처
- **Backend**: Python FastAPI (별도 관리 서버에서 실행)
- **Frontend**: React + Vite + TypeScript + Tailwind CSS
- **바이너리 서버 접근**: WebDAV (조회), SSH/SFTP (삭제, 디스크 확인)
- **DB**: SQLite (삭제 이력 로그)
- **인증**: 공유 비밀번호 → JWT 토큰

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

1. SSH로 디스크 사용량 확인 (`df`)
2. 사용률 >= 90% 이면 정리 시작
3. WebDAV로 전체 빌드 목록 수집 (프로젝트명, 빌드번호, 수정일)
4. 각 빌드에 삭제 점수 부여:
   - 프로젝트명 → glob 패턴 매칭 → 보관 타입 결정
   - `점수 = 타입우선순위 × 1000 + 남은보관일수 × 10`
   - 점수가 낮을수록 먼저 삭제 (만료된 단기보관 빌드 → 미만료 단기보관 → 만료된 장기보관 → ...)
5. 점수 오름차순으로 빌드 삭제, 매 삭제 후 디스크 재확인
6. 사용률 <= 80% 도달 시 중단 (히스테리시스)

## 설정 파일 형식 (`backend/config.yaml`)

```yaml
binary_server:
  webdav_url: "http://binary-server:8080"
  ssh_host: "binary-server"
  ssh_port: 22
  ssh_username: "binmanager"
  ssh_key_path: "/home/app/.ssh/id_rsa"
  binary_root_path: "/data/binaries"

disk:
  trigger_threshold_percent: 90
  target_threshold_percent: 80
  check_interval_minutes: 5

retention_types:
  - name: "nightly"
    retention_days: 3
    priority: 1          # 우선순위 낮음 (먼저 삭제)
  - name: "release"
    retention_days: 30
    priority: 3          # 우선순위 높음 (나중에 삭제)

project_mappings:
  - pattern: "nightly-*"
    type: "nightly"
  - pattern: "release-*"
    type: "release"
  - pattern: "*"
    type: "nightly"      # 기본값

auth:
  shared_password: "changeme"
  jwt_secret: "generated-secret"
```

## 프로젝트 구조

```
binary-manager/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI 진입점, CORS, lifespan
│   │   ├── config.py                # YAML 설정 로더 (Pydantic)
│   │   ├── auth.py                  # 공유 비밀번호 JWT 인증
│   │   ├── database.py              # SQLite + SQLAlchemy
│   │   ├── models.py                # CleanupLog, CleanupRun 모델
│   │   ├── schemas.py               # API 요청/응답 스키마
│   │   ├── routers/
│   │   │   ├── auth_router.py       # POST /api/auth/login
│   │   │   ├── dashboard_router.py  # GET /api/dashboard/stats
│   │   │   ├── binaries_router.py   # GET /api/binaries, DELETE
│   │   │   ├── config_router.py     # GET/PUT /api/config
│   │   │   ├── cleanup_router.py    # POST /api/cleanup/trigger
│   │   │   └── logs_router.py       # GET /api/logs
│   │   └── services/
│   │       ├── webdav_service.py    # WebDAV 조회 (프로젝트/빌드 목록)
│   │       ├── ssh_service.py       # SSH 디스크 확인, SFTP 삭제
│   │       ├── retention_engine.py  # 정리 알고리즘 핵심 로직
│   │       ├── scheduler_service.py # APScheduler 주기적 체크
│   │       └── cleanup_log_service.py
│   ├── config.yaml
│   ├── requirements.txt
│   └── tests/
├── frontend/
│   ├── src/
│   │   ├── App.tsx
│   │   ├── api/                     # Axios 클라이언트
│   │   ├── context/AuthContext.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── DashboardPage.tsx    # 디스크 게이지, 통계 카드
│   │   │   ├── BinaryListPage.tsx   # 프로젝트/빌드 테이블
│   │   │   ├── SettingsPage.tsx     # 보관 정책 편집
│   │   │   └── LogsPage.tsx         # 삭제 이력
│   │   └── components/
│   │       ├── Layout.tsx, Sidebar.tsx
│   │       ├── DiskUsageGauge.tsx
│   │       ├── ProjectTable.tsx
│   │       └── RetentionBadge.tsx
│   ├── package.json
│   └── vite.config.ts
├── docker-compose.yml
└── README.md
```

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/login` | 비밀번호 → JWT 토큰 |
| GET | `/api/dashboard/stats` | 디스크 사용량, 프로젝트 수, 빌드 수 |
| GET | `/api/binaries` | 전체 프로젝트 목록 (타입, 빌드 수 포함) |
| GET | `/api/binaries/{project}` | 프로젝트 내 빌드 목록 (나이, 만료 여부) |
| DELETE | `/api/binaries/{project}/{build}` | 특정 빌드 수동 삭제 |
| GET | `/api/config` | 현재 설정 조회 |
| PUT | `/api/config` | 설정 수정 (보관 정책, 임계값 등) |
| POST | `/api/cleanup/trigger` | 수동 정리 실행 (dry_run 지원) |
| GET | `/api/cleanup/status` | 정리 진행 상태 |
| GET | `/api/logs/runs` | 정리 실행 이력 |
| GET | `/api/logs` | 삭제 상세 이력 |
| GET | `/api/health` | 헬스 체크 |

## 주요 의존성

**Backend**: fastapi, uvicorn, python-jose, pyyaml, webdavclient3, paramiko, apscheduler, sqlalchemy
**Frontend**: react, react-router-dom, axios, recharts, tailwindcss, lucide-react

## 구현 순서

### Phase 1: 백엔드 기반 (config, auth, DB)
1. 프로젝트 스캐폴딩 (디렉터리, requirements.txt, package.json)
2. `config.py` + `config.yaml`
3. `database.py` + `models.py`
4. `auth.py` + `auth_router.py`

### Phase 2: 서버 연동 (WebDAV, SSH)
5. `ssh_service.py` (디스크 사용량, 재귀 삭제)
6. `webdav_service.py` (프로젝트/빌드 목록)
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
18. SettingsPage (보관 정책 편집)
19. LogsPage

### Phase 5: 배포
20. Dockerfile (backend, frontend)
21. docker-compose.yml
22. nginx 설정 (프론트엔드 정적 파일 + API 프록시)

## 검증 방법

1. **단위 테스트**: `retention_engine.py`의 점수 산정 및 삭제 순서 테스트
2. **통합 테스트**: 모의 WebDAV/SSH 서버로 전체 플로우 테스트
3. **수동 테스트**:
   - 웹 UI 로그인 → 대시보드 확인
   - 바이너리 목록 조회, 프로젝트별 빌드 확인
   - dry_run으로 정리 시뮬레이션 실행
   - 설정 변경 후 저장 및 반영 확인
4. **Docker**: `docker-compose up`으로 전체 스택 실행 확인

## 주의사항

- rsync 진행 중인 빌드 보호: 수정일이 10분 이내인 빌드는 삭제 건너뜀
- WebDAV 성능: 빌드 목록 캐싱 (TTL 60초)
- SSH 연결 풀링: 반복 연결 오버헤드 최소화
- 시간대: 모든 타임스탬프 UTC 기준 처리
