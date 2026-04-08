# Binary Retention Manager - Claude Code 지침

## 프로젝트 개요
Android 빌드 바이너리 보관 관리 도구. FastAPI 백엔드 + React 프론트엔드.
원격 바이너리 서버의 디스크 사용량을 Disk Agent HTTP API로 모니터링하고, 보관 정책에 따라 빌드를 자동 삭제한다.
서버별 독립 디스크 임계값을 지원한다.

## 기술 스택
- **Backend**: Python 3.12, FastAPI, SQLAlchemy (MySQL), httpx, APScheduler
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, lucide-react
- **Disk Agent**: Python 3.12, FastAPI, uvicorn — 바이너리 서버에 배포. 디스크 사용량, 파일 목록/삭제 처리
- **배포**: Docker Compose (MySQL + backend + frontend + disk-agent, 4개 서비스, 포트: 9091/9092/9093)

## 프로젝트 구조
```
docker-compose.yml     # db + backend + frontend + disk-agent (4개 서비스)
setup.sh               # 초기 설정 (~/binary-manager-backup/ 생성)
disk-agent/            # 바이너리 서버용 Disk Agent
  Dockerfile           # Python 3.12 + uvicorn
  disk_agent.py        # FastAPI: 디스크 사용량, 파일 목록/삭제
  requirements.txt     # fastapi, uvicorn
backend/               # FastAPI 백엔드
  Dockerfile           # Python 3.12 + uvicorn
  app/
    main.py            # 진입점, CORS, lifespan
    config.py          # YAML 설정 로더 (Pydantic 모델)
    auth.py            # JWT 인증 (username/password, admin/user 역할)
    database.py        # MySQL 엔진 + 세션
    models.py          # SQLAlchemy 모델 (CleanupRun, CleanupLog, BuildRetentionOverride)
    schemas.py         # Pydantic 요청/응답 스키마
    routers/           # API 라우트 핸들러
    services/          # 비즈니스 로직 (disk_agent 클라이언트, retention engine, scheduler)
  tests/               # pytest 테스트
  config.yaml          # 런타임 설정
frontend/              # React SPA
  Dockerfile           # Node 빌드 → nginx (SPA + API 프록시)
  nginx.conf           # /api/ → backend:8000 프록시 + SPA fallback
  src/
    api/client.ts      # Axios API 클라이언트 (JWT 인터셉터)
    context/           # React 컨텍스트 (AuthContext)
    pages/             # 페이지 컴포넌트
    components/        # 공유 UI 컴포넌트
```

## 명령어

### Backend
```bash
# 테스트 실행
cd backend && python -m pytest tests/ -v

# 개발 서버 실행
cd backend && uvicorn app.main:app --reload --port 8000

# 의존성 설치
pip install -r backend/requirements.txt
```

### Frontend
```bash
# 의존성 설치
cd frontend && npm install

# 개발 서버 실행 (/api → localhost:8000 프록시)
cd frontend && npm run dev

# 프로덕션 빌드
cd frontend && npm run build
```

### Disk Agent
```bash
# 개발 서버 실행
cd disk-agent && pip install -r requirements.txt
python disk_agent.py --path /your/binaries --port 9090 --reload
```

### Docker
```bash
./setup.sh                         # 최초 1회 (~/binary-manager-backup/ 생성)
docker compose up --build          # 전체 스택
docker compose up --build -d       # 백그라운드
docker compose down                # 중지
docker compose up --build backend  # 단일 서비스 재빌드
```

## 핵심 설계 결정

### 보관 점수 알고리즘
`score = retention_days - age_days` (남은 일수)
- 낮은 점수 = 먼저 삭제
- 음수 점수 = 만료됨 (미만료 빌드보다 먼저 삭제)
- Custom project는 더 긴 retention_days로 보호 가능

### 히스테리시스 클린업 (서버별)
- 설정된 디스크 사용률 초과 시 클린업 시작 (기본 90%)
- 설정된 디스크 사용률 이하 시 클린업 중단 (기본 80%)
- 잦은 on/off 반복 방지

### 안전 장치
- 최근 10분 이내 수정된 빌드는 건너뜀 (업로드 보호)
- 빌드 목록 결과 60초 캐싱
- 빌드별 보관 기간 개별 설정 가능 (override → project custom → global default)

## 코딩 컨벤션

### Backend
- 모든 API 라우트는 `/api/` 접두사
- 라우터 파일: `{domain}_router.py`
- 서비스 파일: `{domain}_service.py`
- 모든 타임스탬프 UTC
- 모든 요청/응답에 Pydantic 모델 사용
- SQLAlchemy mapped_column 스타일

### Frontend
- 함수형 컴포넌트 + hooks
- API 호출은 `src/api/client.ts` (중앙 Axios 인스턴스)
- Tailwind 유틸리티 클래스 (CSS 모듈 없음)
- lucide-react 아이콘
- react-router-dom v7 라우팅

## 설정 파일 (`backend/config.yaml`)
- `binary_servers`: 서버 목록, 각각:
  - `name`, `disk_agent_url`, `binary_root_path`, `project_depth`
  - `trigger_threshold_percent`, `target_threshold_percent`, `check_interval_minutes`
  - `custom_projects`: [{path, retention_days}] 프로젝트별 보관 기간 재정의
- `retention`: 전역 기본값
  - `default_days`: 비-custom 프로젝트 보관 기간 (기본: 7)
  - `custom_default_days`: custom project 추가 시 기본값 (기본: 30)
  - `log_retention_days`: 클린업 로그 보관 기간 (기본: 30)
- `auth`: users [{username, password, role}], jwt_secret

## 데이터 저장
- MySQL 데이터: `~/binary-manager-backup/mysql/` (호스트 볼륨)
- `config.yaml`: `~/binary-manager-backup/config.yaml` (호스트 볼륨 마운트, Settings에서 변경 시 영구 저장)
- `setup.sh`로 초기 디렉토리 및 config.yaml 생성

## 테스트
- 단위 테스트는 `retention_engine.py` 점수 계산에 집중
- 순수 함수 테스트, 모킹 불필요
- `backend/` 디렉토리에서 실행: `python -m pytest tests/ -v`
