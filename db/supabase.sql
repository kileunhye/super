create table if not exists public.setek_records (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  grade text not null,
  subject text not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.setek_records enable row level security;
-- 운영 시 인증 사용자 정책으로 교체하세요. 익명 데모 저장이 필요할 때만 사용합니다.
create policy "demo read" on public.setek_records for select using (true);
create policy "demo insert" on public.setek_records for insert with check (true);
