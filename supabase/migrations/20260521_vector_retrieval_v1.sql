create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count int,
  filter_document_id uuid default null
)
returns table (
  id uuid,
  document_id uuid,
  chunk_index int,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    dc.id,
    dc.document_id,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks as dc
  where dc.embedding is not null
    and (
      filter_document_id is null
      or dc.document_id = filter_document_id
    )
  order by similarity desc
  limit greatest(match_count, 1);
$$;
