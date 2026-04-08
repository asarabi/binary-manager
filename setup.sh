#!/bin/bash
# Binary Manager 초기 설정 스크립트
# 사용법: ./setup.sh

BACKUP_DIR="${HOME}/binary-manager-backup"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Binary Manager 초기 설정 ==="

# 1. 백업 디렉토리 생성
mkdir -p "${BACKUP_DIR}"
echo "[1/2] 디렉토리 생성: ${BACKUP_DIR}"

# 2. config.yaml 복사 (없을 경우에만)
if [ ! -f "${BACKUP_DIR}/config.yaml" ]; then
    cp "${SCRIPT_DIR}/backend/config.yaml" "${BACKUP_DIR}/config.yaml"
    echo "[2/2] config.yaml 복사 완료"
else
    echo "[2/2] config.yaml 이미 존재 (스킵)"
fi

echo ""
echo "=== 설정 완료 ==="
echo "설정 파일: ${BACKUP_DIR}/config.yaml"
echo ""
echo "이제 'docker compose up --build -d'로 실행하세요."
