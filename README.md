# LUA AI Influencer Automation Platform

AI 버추얼 인플루언서 루아(LUA)의 콘텐츠를 기획, 생성, 후처리, 검수, 배포, 분석으로 흘려보내는 반자동 파이프라인 플랫폼입니다. 1단계는 배포 가능한 빈 골격, Supabase DB 스키마, Inngest 진입점, 인증이 걸린 검수 대시보드 셸까지 포함합니다.

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

`SUPABASE_SERVICE_ROLE_KEY`는 서버 전용입니다. `NEXT_PUBLIC_` 접두사를 붙이거나 클라이언트 코드에서 참조하지 마세요. 로컬에서 Inngest dev server 없이 `/api/inngest`를 확인할 때는 `INNGEST_DEV=1`을 둡니다.

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

## Phase 1 Scope

- `supabase/migrations/0001_initial_schema.sql`: 상태 기계 중심 DB 스키마
- `supabase/seed.sql`: 루아 페르소나 1건과 prompt template v1.0 placeholder
- `src/lib/supabase`: browser anon client, server authenticated client, service role client
- `src/inngest`: hello world function and phase 2 transition stubs
- `src/app/(dashboard)/review`: authenticated content job list
- `src/app/api`: Inngest, webhook, cron route entrypoints

실제 LLM 호출, 이미지/영상 생성, Shotstack 편집, Slack 검수 버튼, Ayrshare 게시, 성과 수집은 2단계 이후 구현합니다.

## Verification

```bash
npm run lint
npm run typecheck
npm run build
```

GitHub Actions에서도 같은 순서로 CI가 실행됩니다.
