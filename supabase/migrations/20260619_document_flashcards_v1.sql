create table if not exists public.document_flashcards (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null,
  question text not null,
  answer text not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists document_flashcards_document_id_created_at_idx
  on public.document_flashcards (document_id, created_at desc, id);

create index if not exists document_flashcards_user_id_created_at_idx
  on public.document_flashcards (user_id, created_at desc, id);

grant select, insert, delete on table public.document_flashcards to authenticated;

alter table public.document_flashcards enable row level security;

drop policy if exists "Users can select own document flashcards"
  on public.document_flashcards;
create policy "Users can select own document flashcards"
  on public.document_flashcards
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.documents
      where documents.id = document_flashcards.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own document flashcards"
  on public.document_flashcards;
create policy "Users can insert own document flashcards"
  on public.document_flashcards
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.documents
      where documents.id = document_flashcards.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own document flashcards"
  on public.document_flashcards;
create policy "Users can delete own document flashcards"
  on public.document_flashcards
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.documents
      where documents.id = document_flashcards.document_id
        and documents.user_id = auth.uid()
    )
  );
