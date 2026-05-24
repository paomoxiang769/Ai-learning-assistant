create table if not exists public.document_chat_messages (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  sources jsonb,
  created_at timestamp with time zone not null default now()
);

create index if not exists document_chat_messages_document_id_created_at_idx
  on public.document_chat_messages (document_id, created_at, id);

create index if not exists document_chat_messages_user_id_idx
  on public.document_chat_messages (user_id);

grant select, insert, delete on table public.document_chat_messages to authenticated;

alter table public.document_chat_messages enable row level security;

drop policy if exists "Users can select own document chat messages"
  on public.document_chat_messages;
create policy "Users can select own document chat messages"
  on public.document_chat_messages
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.documents
      where documents.id = document_chat_messages.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "Users can insert own document chat messages"
  on public.document_chat_messages;
create policy "Users can insert own document chat messages"
  on public.document_chat_messages
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.documents
      where documents.id = document_chat_messages.document_id
        and documents.user_id = auth.uid()
    )
  );

drop policy if exists "Users can delete own document chat messages"
  on public.document_chat_messages;
create policy "Users can delete own document chat messages"
  on public.document_chat_messages
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.documents
      where documents.id = document_chat_messages.document_id
        and documents.user_id = auth.uid()
    )
  );
