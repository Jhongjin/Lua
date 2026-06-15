# LUA AI Influencer Automation Platform

AI 버추얼 인플루언서 루아(LUA)의 콘텐츠를 기획, 생성, 후처리, 검수, 배포, 분석으로 흘려보내는 반자동 파이프라인 플랫폼입니다. 현재 범위는 기획안 생성과 이미지 에셋 경로 3-A까지 포함합니다.

## Stack

- Next.js App Router + TypeScript
- Supabase Postgres, Auth, Storage, RLS
- Inngest orchestration
- Vercel deployment

## Local Setup

1. 의존성을 설치합니다.

```bash
npm install
```

2. 환경변수 파일을 만듭니다.

```bash
cp .env.example .env.local
```

`SUPABASE_SERVICE_ROLE_KEY`는 서버 전용입니다. `NEXT_PUBLIC_` 접두사를 붙이거나 클라이언트 코드에서 참조하지 마세요. 로컬에서 Inngest Dev Server를 쓸 때만 `INNGEST_DEV=http://localhost:8288`을 둡니다. Vercel Production에는 `INNGEST_DEV`를 설정하지 않습니다.

3. Supabase를 준비합니다.

```bash
npx supabase start
npx supabase db reset
```

원격 Supabase 프로젝트를 쓰는 경우에는 프로젝트를 link한 뒤 migration과 seed를 적용합니다.

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push --include-seed
```

`supabase link`가 권한 문제로 실패하면 Supabase Dashboard의 SQL Editor에서
`supabase/migrations/0001_initial_schema.sql`을 먼저 실행하고,
이어서 `supabase/seed.sql`을 실행합니다. 또는 Database Settings에서 connection
string을 복사해 아래처럼 Management API를 우회할 수 있습니다.

```bash
npx supabase db push --db-url "<postgres-connection-string>" --include-seed
```

4. DB 타입을 갱신합니다.

```bash
npm run supabase:types
```

5. 로컬 앱을 실행합니다.

```bash
npm run dev
```

앱은 `http://localhost:3000`에서 열립니다. 루트 경로는 `/review`로 이동하며, Supabase Auth 세션이 없으면 `/login`으로 이동합니다.

## Inngest

로컬 개발은 두 터미널을 사용합니다.

```bash
npm run dev
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest
```

Production은 Inngest Cloud의 `Apps > Sync new app`에서 Vercel production alias를 sync합니다.

```text
https://lua-jeonhongjins-projects.vercel.app/api/inngest
```

현재 등록되는 함수는 다음과 같습니다.

- `lua-hello-world`
- `lua-plan-content`
- `lua-generate-assets`
- `lua-edit-content`

## Implemented Scope

- `supabase/migrations/0001_initial_schema.sql`: 상태 기계 중심 DB 스키마
- `supabase/migrations/0002_image_source.sql`: `image_source` enum과 `content_jobs.image_source`
- `supabase/seed.sql`: 루아 페르소나 1건과 prompt template v1.0 placeholder
- `src/lib/supabase`: browser anon client, server authenticated client, service role client
- `src/lib/llm/planner.ts`: Anthropic tool-use 기반 기획안 생성
- `src/lib/assets/image.ts`: Hedra 우선, fal 폴백 이미지 생성 경계
- `src/lib/assets/manual-upload.ts`: 수동 이미지 업로드와 `ASSETS_READY` 전이
- `src/lib/validation`: 기획안/이미지 검증 게이트
- `src/inngest`: 기획, 이미지 에셋, 이미지 후처리 함수
- `src/app/(dashboard)/review`: authenticated content job list, manual upload UI
- `src/app/api`: Inngest, webhook, cron route entrypoints

영상 생성 및 후처리(`reels`), Slack 검수 버튼, Ayrshare 게시, 성과 수집은 이후 단계에서 구현합니다.

## Image Asset Path

`image_source`는 다음 값을 가집니다.

- `manual`: 대시보드에서 이미지 파일 업로드 후 `ASSETS_READY -> EDITED`
- `hedra`: Hedra API로 이미지 생성
- `fal`: fal API로 이미지 생성
- `auto`: Hedra 실패 또는 검증 실패 시 fal 폴백

Production 자동 생성에는 아래 서버 환경변수가 필요합니다.

```bash
HEDRA_API_KEY=
FAL_API_KEY=
FAL_IMAGE_MODEL=
FAL_REFERENCE_IMAGE_MODEL=
HEDRA_IMAGE_MODEL_ID=
```

`FAL_IMAGE_MODEL`, `FAL_REFERENCE_IMAGE_MODEL`, `HEDRA_IMAGE_MODEL_ID`는 선택 값입니다. Hedra는 기본적으로 공식 예제의 text-to-image 모델을 우선 선택하고, fal은 `fal-ai/flux/schnell`을 기본 text-to-image 모델로 사용합니다. API 키가 없을 때는 수동 업로드 경로만 검증할 수 있습니다.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```

GitHub Actions에서도 같은 순서로 CI가 실행됩니다.
