-- ============================================================================
--  발주처 마스터 + 부가세 컬럼 마이그레이션
--  Supabase 대시보드 → SQL Editor 에 붙여넣고 [Run] 하세요.
--  여러 번 실행해도 안전합니다 (IF NOT EXISTS 사용).
--  기존 데이터는 삭제되지 않으며, 기존 금액 계산 결과도 바뀌지 않습니다.
-- ============================================================================

-- ── 1. 발주처(공급업체) 마스터 ──────────────────────────────────────────────
create table if not exists public.suppliers (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  code           text,
  manager        text,
  phone          text,
  email          text,
  biz_no         text,
  payment_terms  text,
  -- 제품에 등록한 매입가가 부가세를 포함한 금액인지 여부.
  -- 기존 데이터의 지급액이 달라지지 않도록 기본값은 true(포함).
  vat_included   boolean not null default true,
  memo           text,
  created_at     timestamptz not null default now()
);

-- 같은 사용자 안에서 발주처 이름은 유일해야 한다 (오타로 업체가 갈라지는 것을 방지)
create unique index if not exists suppliers_user_name_key
  on public.suppliers (user_id, name);

alter table public.suppliers enable row level security;

drop policy if exists "suppliers_select_own" on public.suppliers;
create policy "suppliers_select_own" on public.suppliers
  for select using (auth.uid() = user_id);

drop policy if exists "suppliers_insert_own" on public.suppliers;
create policy "suppliers_insert_own" on public.suppliers
  for insert with check (auth.uid() = user_id);

drop policy if exists "suppliers_update_own" on public.suppliers;
create policy "suppliers_update_own" on public.suppliers
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "suppliers_delete_own" on public.suppliers;
create policy "suppliers_delete_own" on public.suppliers
  for delete using (auth.uid() = user_id);

-- ── 2. 제품 테이블 확장 ────────────────────────────────────────────────────
alter table public.products
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

-- 과세 구분: 'taxable'(과세) | 'exempt'(면세)
alter table public.products
  add column if not exists vat_type text not null default 'taxable';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_vat_type_check'
  ) then
    alter table public.products
      add constraint products_vat_type_check check (vat_type in ('taxable', 'exempt'));
  end if;
end $$;

create index if not exists products_supplier_id_idx on public.products (supplier_id);

-- ── 3. 매출 기록 테이블 확장 ───────────────────────────────────────────────
alter table public.sales_records
  add column if not exists supplier_id uuid references public.suppliers(id) on delete set null;

-- 매입액을 공급가액 / 부가세로 분리해 보관한다.
-- total_purchase_amount(기존, 부가세 포함 지급액)는 그대로 유지된다.
alter table public.sales_records
  add column if not exists total_supply_amount numeric not null default 0;

alter table public.sales_records
  add column if not exists total_vat_amount numeric not null default 0;

-- 기존 행 보정: 예전 데이터는 매입가를 부가세 포함가로 간주해 역산해 둔다.
-- (0으로 남겨두면 통계에서 공급가액이 0으로 보이기 때문)
update public.sales_records
   set total_supply_amount = round(total_purchase_amount / 1.1),
       total_vat_amount    = total_purchase_amount - round(total_purchase_amount / 1.1)
 where total_supply_amount = 0
   and total_purchase_amount > 0;

-- ============================================================================
--  4. [중요] 핵심 테이블 RLS 점검
--
--  아래 테이블들은 사용자 개인 데이터를 담고 있습니다. RLS가 꺼져 있으면
--  anon 키만으로 다른 사용자의 제품·매출 데이터를 읽을 수 있습니다.
--  anon 키가 소스코드에 공개되는 것은 정상이지만, 그 전제는 RLS가 켜져 있는 것입니다.
--
--  먼저 아래 조회로 현재 상태를 확인하세요.
-- ============================================================================

-- 현재 RLS 상태 확인 (rowsecurity 가 false 인 테이블이 위험합니다)
--   select tablename, rowsecurity
--     from pg_tables
--    where schemaname = 'public'
--      and tablename in ('products','invoice_templates','sales_records','profiles','activity_logs');

-- 정책이 이미 있는지 확인
--   select tablename, policyname, cmd from pg_policies where schemaname = 'public';

-- ---------------------------------------------------------------------------
-- RLS가 꺼져 있다면 아래 블록의 주석을 풀어 실행하세요.
-- ※ 반드시 위 조회로 기존 정책을 먼저 확인하고, 운영 중이라면 점검 시간에 적용하세요.
--   정책 없이 RLS만 켜면 앱에서 데이터가 보이지 않게 됩니다.
-- ---------------------------------------------------------------------------
/*
do $$
declare t text;
begin
  foreach t in array array['products','invoice_templates','sales_records']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s_own_all" on public.%I', t, t);
    execute format(
      'create policy "%s_own_all" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t, t);
  end loop;
end $$;

-- profiles 는 본인 행만 조회/수정
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- activity_logs 는 본인 것만 조회, 삽입은 본인 id로만
alter table public.activity_logs enable row level security;
drop policy if exists "activity_logs_select_own" on public.activity_logs;
create policy "activity_logs_select_own" on public.activity_logs
  for select using (auth.uid() = user_id);
drop policy if exists "activity_logs_insert_own" on public.activity_logs;
create policy "activity_logs_insert_own" on public.activity_logs
  for insert with check (auth.uid() = user_id);
*/

-- ---------------------------------------------------------------------------
-- (선택) 매출 기록 중복을 DB 차원에서도 막고 싶다면.
-- 지금은 애플리케이션에서만 중복을 검사하므로, 동시에 두 번 업로드하면 중복이 들어갈 수 있습니다.
-- 아래를 적용하기 전에 기존 중복 데이터를 먼저 정리해야 합니다.
-- ---------------------------------------------------------------------------
-- 기존 중복 확인:
--   select user_id, order_id, supplier_name, product_name, count(*)
--     from public.sales_records
--    where order_id is not null
--    group by 1,2,3,4 having count(*) > 1;
--
-- 정리 후 적용:
--   create unique index if not exists sales_records_dedup_key
--     on public.sales_records (user_id, order_id, supplier_name, product_name)
--     where order_id is not null;

-- ── 송장 양식 열별 '다른 이름' (별칭) ──────────────────────────────────────
-- 주문서마다 열 제목이 달라지는 것을 흡수한다.
-- headers 와 같은 순서·길이의 배열의 배열.
-- 예) headers = ["주문번호","수취인명"] 이면
--     header_aliases = [["오더번호"], ["받는분","수령인"]]
alter table public.invoice_templates
  add column if not exists header_aliases jsonb;

-- ── 묶음배송 가능 표시 ─────────────────────────────────────────────────────
-- 같은 수취인·주소로 가는 같은 발주처 제품끼리 송장 한 장으로 묶을지 여부.
-- 기존 동작이 바뀌지 않도록 기본값은 false(묶지 않음).
alter table public.products
  add column if not exists bundle_shipping boolean not null default false;
