create table if not exists public.document_notes (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null,
  title text,
  content text not null,
  note_type text not null check (note_type in ('ai_summary', 'manual')),
  created_at timestamp with time zone not null default now()
);

create index if not exists document_notes_document_id_created_at_idx
  on public.document_notes (document_id, created_at desc, id);

create index if not exists document_notes_user_id_created_at_idx
  on public.document_notes (user_id, created_at desc, id);

grant select, insert, delete on table public.document_notes to authenticated;

alter table public.document_notes enable row level security;

drop policy if exists "Users can select own document notes"
  on public.document_notes;
create policy "Users can select own document notes"
  on public.document_notes
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.documents
      where documents.id = document_notes.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own document notes"
  on public.document_notes;
create policy "Users can insert own document notes"
  on public.document_notes
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.documents
      where documents.id = document_notes.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own document notes"
  on public.document_notes;
create policy "Users can delete own document notes"
  on public.document_notes
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.documents
      where documents.id = document_notes.document_id
        and documents.user_id = auth.uid()
    )
  );
