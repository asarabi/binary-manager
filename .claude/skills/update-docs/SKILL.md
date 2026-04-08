---
name: update-docs
description: 프로젝트의 모든 md 문서를 현재 코드 구조에 맞게 업데이트
user-invocable: true
allowed-tools: Read, Edit, Glob, Grep, Bash
---

# 문서 업데이트

코드베이스를 스캔하고 모든 md 문서를 현재 상태에 맞게 업데이트한다.

## 순서

### 1. 문서 파일 찾기

프로젝트 루트와 주요 디렉토리에서 모든 md 파일을 찾는다:

```bash
find . -name "*.md" -not -path "./.git/*" -not -path "./node_modules/*" -not -path "./.claude/skills/*" -not -path "./.claude/projects/*"
```

### 2. 현재 코드 상태 파악

아래 파일들을 읽어 현재 구현 상태를 파악한다:

```
backend/app/main.py              # API 구조, 라우터
backend/app/config.py            # 설정 모델
backend/app/database.py          # DB 타입
backend/requirements.txt         # 백엔드 의존성
docker-compose.yml               # 서비스 구성, 볼륨, 포트
backend/config.yaml              # 설정 구조
frontend/package.json            # 프론트엔드 의존성
disk-agent/disk_agent.py         # Disk Agent 엔드포인트
```

또한 실행:
```bash
ls backend/app/routers/          # 라우터 목록
ls backend/app/services/         # 서비스 목록
ls */Dockerfile 2>/dev/null      # Dockerfile 위치
```

### 3. 불일치 확인

수집한 정보를 각 md 파일과 비교한다. 주요 확인 사항:
- DB 타입 불일치
- 누락/변경된 API 라우트
- docker-compose 구조 변경
- 의존성 변경 (추가/삭제)
- 서비스/라우터 추가/삭제
- 프로젝트 구조 변경 (파일/디렉토리)
- 설정 파일 필드 변경
- Disk Agent 엔드포인트 변경

### 4. 문서 업데이트

각 md 파일에서 사실과 다른 부분만 수정한다:
- 기술 스택 (DB, 의존성)
- 아키텍처 다이어그램
- 프로젝트 구조 (파일 추가/삭제)
- Docker 명령어 (compose 구조 변경 시)
- API 엔드포인트 (라우트 변경 시)
- 설정 설명 (필드 변경 시)

### 5. 결과 보고

변경 사항을 요약한다:
```
## 문서 업데이트 완료

### README.md
- 기술 스택 업데이트
- 프로젝트 구조 수정

### CLAUDE.md
- 의존성 목록 갱신

### PLAN.md
- 변경 없음

변경 불필요: AGENT.md
```

## 규칙

- 모든 문서는 한국어로 작성한다
- 기존 포맷과 구조를 유지한다
- 사실과 다른 정보만 수정한다 (불필요한 리팩토링 금지)
- 새 섹션은 꼭 필요한 경우에만 추가한다
- 코딩 컨벤션은 실제로 변경된 경우에만 수정한다
