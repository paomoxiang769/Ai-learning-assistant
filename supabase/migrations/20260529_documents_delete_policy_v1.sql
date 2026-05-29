grant delete on table public.documents to authenticated;

drop policy if exists "Users can delete own documents"
  on public.documents;
create policy "Users can delete own documents"
  on public.documents
  for delete
  to authenticated
  using (user_id = auth.uid());

grant delete on table public.document_chunks to authenticated;

drop policy if exists "Users can delete chunks for own documents"
  on public.document_chunks;
create policy "Users can delete chunks for own documents"
  on public.document_chunks
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.documents
      where documents.id = document_chunks.document_id
        and documents.user_id = auth.uid()
    )
  );
