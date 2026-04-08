# Agent 지침 - Binary Retention Manager

## 역할
원격 바이너리 서버의 Android 빌드 아티팩트를 모니터링하고 정리하는 시스템을 개발한다.

## 빠른 참조

### 아키텍처
```
[브라우저] → [nginx:80 (frontend)] → [React SPA]
                                    → /api/* → [FastAPI:8000 (backend)] → [Disk Agent:9090] (디스크/파일)
                                                                         → [MySQL:3306]      (로그)
```

### 핵심 흐름
1. 사용자가 username/password로 로그인 → JWT 토큰 발급 (admin 또는 user 역할)
2. 대시보드에서 서버별 디스크 사용량, 프로젝트/빌드 수 확인
3. 스케줄 또는 수동 클린업:
   - Disk Agent `/disk-usage`로 디스크 확인
   - 90% 이상이면 Disk Agent `/files/list`로 빌드 목록 수집
   - 각 빌드 점수 계산: `retention_days - age_days` (남은 일수)
   - 점수 낮은 빌드부터 Disk Agent `DELETE /files`로 삭제
   - 80% 이하가 되면 중단

### 파일 위치

| 항목 | 경로 |
|------|------|
| FastAPI 앱 | `backend/app/main.py` |
| 설정 로더 | `backend/app/config.py` |
| 런타임 설정 | `backend/config.yaml` |
| DB 모델 | `backend/app/models.py` |
| API 스키마 | `backend/app/schemas.py` |
| 인증 (JWT) | `backend/app/auth.py` |
| API 라우트 | `backend/app/routers/*.py` |
| 비즈니스 로직 | `backend/app/services/*.py` |
| 클린업 알고리즘 | `backend/app/services/retention_engine.py` |
| Disk Agent 클라이언트 | `backend/app/services/disk_agent_service.py` |
| 테스트 | `backend/tests/` |
| React 진입점 | `frontend/src/main.tsx` |
| API 클라이언트 | `frontend/src/api/client.ts` |
| 페이지 | `frontend/src/pages/*.tsx` |
| 컴포넌트 | `frontend/src/components/*.tsx` |
| Disk Agent | `disk-agent/disk_agent.py` |

### API 엔드포인트

```
POST /api/auth/login              # {username, password} → {access_token, role}
GET  /api/dashboard/stats         # 서버별 디스크 사용량, 프로젝트/빌드 수
GET  /api/binaries                # 프로젝트 목록 (보관 정보, 서버 필터)
GET  /api/binaries/detail/{p}     # 빌드 목록 (남은 일수 포함)
DELETE /api/binaries/detail/{p}/{b}  # 수동 삭제
GET  /api/config                  # 현재 설정 조회
PUT  /api/config                  # 설정 수정 (admin 전용)
POST /api/config/test-connection  # 서버 연결 테스트 (admin 전용)
POST /api/cleanup/trigger         # {dry_run: bool}
GET  /api/cleanup/status          # 정리 진행 상태
GET  /api/logs/runs               # 정리 실행 이력 (페이지네이션)
GET  /api/logs                    # 삭제 상세 이력 (페이지네이션)
GET  /api/health                  # 헬스 체크
```

### Disk Agent 엔드포인트 (바이너리 서버)

```
GET    /disk-usage                # 전체 디스크 사용량
GET    /dir-size?path=sub/dir     # 디렉토리 크기
GET    /files/list?path=&depth=1  # 디렉토리 목록 (mtime 포함)
GET    /files/exists?path=sub/dir # 경로 존재 확인
DELETE /files?path=sub/dir        # 디렉토리 삭제
GET    /health                    # 헬스 체크
```

## 개발 가이드

### Custom Project 보관 기간 재정의 추가
1. `config.yaml`에서 해당 서버의 `custom_projects`에 항목 추가
2. 또는 UI의 Settings 페이지에서 추가 (admin 전용)

### 새 API 엔드포인트 추가
1. `backend/app/routers/`에 라우터 생성 또는 확장
2. `backend/app/schemas.py`에 Pydantic 스키마 추가
3. 새 파일이면 `backend/app/main.py`에 라우터 등록
4. `frontend/src/api/client.ts`에 API 호출 추가

### 새 프론트엔드 페이지 추가
1. `frontend/src/pages/`에 페이지 컴포넌트 생성
2. `frontend/src/App.tsx`에 라우트 추가
3. `frontend/src/components/Sidebar.tsx`에 사이드바 링크 추가

### 테스트
```bash
cd backend && python -m pytest tests/ -v
```
- 점수 계산 테스트는 순수 함수 (외부 의존성 없음)
- 서비스 레벨 테스트 시 `disk_agent_service` 모킹

## 주요 제약 사항
- 모든 타임스탬프 UTC
- 최근 10분 이내 수정된 빌드는 절대 삭제하지 않음 (업로드 보호)
- 빌드 목록 캐시 TTL: 60초
- JWT 토큰 만료: 24시간
- API를 통한 설정 변경은 `config.yaml`에 영구 저장
- 클린업은 백그라운드 스레드에서 실행 (API 응답 비차단)
- 동시에 하나의 클린업만 실행 가능 (`_cleanup_running` 플래그로 뮤텍스)
- 멀티 바이너리 서버 지원, 서버별 독립 임계값
