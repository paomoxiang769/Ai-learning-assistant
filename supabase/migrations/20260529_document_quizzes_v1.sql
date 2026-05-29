create table if not exists public.document_quizzes (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null,
  title text,
  quiz_json jsonb not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists document_quizzes_document_id_created_at_idx
  on public.document_quizzes (document_id, created_at desc, id);

create index if not exists document_quizzes_user_id_created_at_idx
  on public.document_quizzes (user_id, created_at desc, id);

grant select, insert, delete on table public.document_quizzes to authenticated;

alter table public.document_quizzes enable row level security;

drop policy if exists "Users can select own document quizzes"
  on public.document_quizzes;
create policy "Users can select own document quizzes"
  on public.document_quizzes
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.documents
      where documents.id = document_quizzes.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own document quizzes"
  on public.document_quizzes;
create policy "Users can insert own document quizzes"
  on public.document_quizzes
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.documents
      where documents.id = document_quizzes.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own document quizzes"
  on public.document_quizzes;
create policy "Users can delete own document quizzes"
  on public.document_quizzes
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.documents
      where documents.id = document_quizzes.document_id
        and documents.user_id = auth.uid()
    )
  );
