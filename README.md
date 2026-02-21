# 포켓몬 포획 도감 (ko-KR MVP)

요구사항 반영 버전:
- UI 언어 고정: `ko-KR` (i18n 구조 분리)
- 기본 표시: 버전그룹, 내부 데이터: 버전(game_id) 단위
- 포획 가능/불가/미확인(`unknown`) 상태 구분
- 도감 정보 MVP: 타입/특성/키/몸무게/종족값
- 진화 라인 이동 아이콘(항상 노출 + 비존재 단계 비활성 + 포획 가능 시 강조)

## 실행

```bash
python3 -m http.server 4173
# http://localhost:4173
```

## 데이터 구조

- `data/generated/pokedex.json`: 도감/스탯/진화 스키마
- `data/generated/encounters.json`: 포획 데이터(버전그룹 + 버전 단위)
- `i18n/ko-KR.json`: 한국어 텍스트 리소스

## 빌드

```bash
python3 build_data.py
```

> 네트워크에서 GitHub raw 접근이 차단되면 빌드 스크립트는 실패할 수 있습니다.

## 확장 포인트

- 지도 컴포넌트는 텍스트형(MVP) 기준이며, 향후 SVG+핀으로 분리 확장 가능
- 진화체인/폼 차이는 현재 스키마만 준비 (`evolution.chain`, `evolution.forms`)
