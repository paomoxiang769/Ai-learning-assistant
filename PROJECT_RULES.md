# AI Study Assistant Project Rules

## Tech Stack
- Next.js
- TypeScript
- Tailwind CSS
- Supabase
- OpenAI API

## Development Rules
- Do not rewrite unrelated files.
- Do not implement multiple features at once.
- Explain every major change.
- Keep API routes under `src/app/api`.
- Keep reusable logic under `src/lib`.

## Database Rules
- Use `documents` for uploaded files.
- Use `document_chunks` for RAG chunks.
- Use `questions` for quiz questions.
- Use `attempts` for answer records.

## AI Rules
- AI answers must be based on retrieved document chunks.
- If no relevant content is found, say the material does not mention it.
- Do not hallucinate extra knowledge.

## Workflow
- Use plan mode first.
- Implement one small feature at a time.
- Run tests or `npm run build` after major changes.
- Commit after each working feature.
