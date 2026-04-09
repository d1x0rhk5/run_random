# run_random

욕망의 항아리 분위기로 만든 2중 달리기 뽑기 사이트다.

## 구성

- 숫자 항아리: `0`부터 `50`까지
- 사람 항아리: `human.txt`를 읽어서 사람당 `7`개 공 배정
- 카메라: 확대 없이 트랙 전체 화면 고정
- 테마: `Pot of greed` 기반 커스텀 스타일

## 실행

```bash
npm install
npm run dev
```

## 배포 빌드

```bash
npm run build
```

빌드 결과는 `docs/`에 생성되며, GitHub Pages의 `main /docs` 소스로 바로 쓸 수 있다.

현재 라이브 배포 경로:

- `https://d1x0rhk5.github.io/run_random/`
