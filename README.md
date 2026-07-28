# 세특 스튜디오

학생 활동 키워드와 관찰 내용을 바탕으로 과목별 세부능력 및 특기사항 초안을 생성하고 Supabase에 저장·조회하는 웹앱입니다.

## 주요 기능

- 학년, 학생 식별값, 과목, 활동 키워드 입력
- 수집 → 작성 → 검토의 3단계 에이전트 워크플로우
- 과목별 세특 초안과 검토 결과 표시
- Gemini API 키 및 선호 모델 개인 설정
- Supabase 저장 및 과거 내역 조회
- 텍스트 파일 다운로드

## 로컬 실행

Node.js 22.13 이상과 pnpm을 권장합니다.

```bash
pnpm install
pnpm dev
```

`.env.example`을 `.env.local`로 복사한 뒤 Supabase 프로젝트 값을 설정합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
```

Supabase SQL Editor에서 `db/supabase.sql`을 실행해 `setek_records` 테이블을 생성합니다.

## 검증

```bash
pnpm build
pnpm test
```

## 배포

Vercel 또는 Cloudflare Workers 호환 vinext 빌드를 사용합니다. 배포 환경에도 `.env.example`의 두 환경변수를 등록해야 합니다.
