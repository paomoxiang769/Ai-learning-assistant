# Deployment Guide

This document captures the production readiness checklist for the AI Study
Assistant. It does not introduce any new runtime requirements beyond the
environment and Supabase setup described here.

## Environment Variables

Create `.env.local` from `.env.local.example` for local development and set the
same values in the deployment platform.

Required variables:

- `OPENAI_API_KEY`: API key for the OpenAI-compatible provider used for
  summaries, embeddings, quizzes, notes, review advice, and RAG answers.
- `OPENAI_BASE_URL`: Base URL for the OpenAI-compatible provider, including the
  API version path when required by the provider.
- `OPENAI_MODEL`: Chat/completion model used by summary, answer, quiz, notes,
  and review generation. Individual modules provide defaults, but production
  should set this explicitly.
- `NEXT_PUBLIC_SUPABASE_URL`: Public Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public Supabase anon key used by Supabase
  Auth and RLS-scoped server clients.

Optional local/network/operations variables:

- `HTTP_PROXY`: Optional proxy used by the OpenAI-compatible HTTP client.
- `HTTPS_PROXY`: Optional proxy used by the OpenAI-compatible HTTP client.
- `SUPABASE_SERVICE_ROLE_KEY`: Optional server-only key for controlled
  operational tasks outside the app runtime. The current app does not require it
  and should not use it for user-facing requests.

## Supabase Setup

Production Supabase setup must include:

- Supabase Auth enabled for application users.
- A Postgres database with RLS enabled on user-owned data tables.
- A private Storage bucket named `documents`.
- The `pgvector` extension enabled before vector columns or retrieval functions
  are created.
- User data isolation enforced through `auth.uid()` policies. Do not bypass RLS
  for user-facing reads or writes.

Expected application tables:

- `documents`
- `document_chunks`
- `document_chat_messages`
- `document_quizzes`
- `document_notes`
- `document_flashcards`

Pre-deploy blocker: the repository currently does not include the base migration
that creates `documents` and `document_chunks` with their full select, insert,
update, and delete RLS policies. A new empty Supabase database cannot be fully
initialized from the checked-in migrations alone unless that base schema is
applied separately.

## Migration Order

Run migrations in timestamp order:

1. `supabase/migrations/20260521_vector_retrieval_v1.sql`
2. `supabase/migrations/20260524_document_chat_messages_v1.sql`
3. `supabase/migrations/20260529_documents_delete_policy_v1.sql`
4. `supabase/migrations/20260529_document_quizzes_v1.sql`
5. `supabase/migrations/20260601_document_notes_v1.sql`
6. `supabase/migrations/20260619_document_flashcards_v1.sql`

Before running the checked-in migrations on a new database, apply or add the
missing base schema migration for `documents` and `document_chunks`. The current
checked-in migrations assume those tables already exist.

After migration, verify:

- `documents` rows are scoped by `user_id = auth.uid()`.
- `document_chunks` rows are accessible only through documents owned by the
  current user.
- `document_chat_messages`, `document_quizzes`, `document_notes`, and
  `document_flashcards` can only be selected, inserted, and deleted by the
  owning user.
- `match_document_chunks` exists and returns only chunks for the document ids
  passed by authenticated, user-scoped retrieval code.

## Local Startup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   PowerShell:

   ```powershell
   Copy-Item .env.local.example .env.local
   ```

   Bash:

   ```bash
   cp .env.local.example .env.local
   ```

3. Fill `.env.local` with real Supabase and OpenAI-compatible provider values.

4. Apply the Supabase schema and migrations in the order described above.

5. Start the local app when development is needed:

   ```bash
   npm run dev
   ```

This production readiness pass did not run `npm run build`, did not run
`npm run lint`, and did not start the dev server.

## Verification Commands

Preferred checks before deployment:

```bash
npx tsc --noEmit --incremental false
```

```bash
node --test tests\document-upload-processing.test.mjs tests\ai-summary.test.mjs tests\embedding.test.mjs tests\study-quiz.test.mjs tests\study-notes.test.mjs tests\study-review.test.mjs tests\dashboard.test.mjs tests\review-center.test.mjs tests\api-auth-source.test.mjs tests\auth-guard-source.test.mjs tests\documents-ui.test.mjs tests\dashboard-ui.test.mjs tests\review-center-ui.test.mjs
```

Do not use `npm run build`, `npm run lint`, or a dev server as part of this
specific production readiness check unless explicitly requested.

## Deployment Risk Checklist

- High: missing reproducible base migrations for `documents` and
  `document_chunks`.
- High: incomplete repository-visible RLS proof for `documents` and
  `document_chunks`.
- Low: Node's test runner reports a `MODULE_TYPELESS_PACKAGE_JSON` warning for
  TypeScript ESM test imports. This is not known to block Next.js production
  builds.
- Low: final production readiness still requires checking the real Supabase
  project for the Storage bucket, pgvector extension, migrations, and RLS
  policies.
