-- ============================================================================
--  송장.com — 전체 스키마 (새 Supabase 프로젝트용)
--
--  [언제 쓰나] Supabase 프로젝트를 새로 만들어서 처음부터 세팅할 때.
--             기존 프로젝트를 계속 쓰신다면 이 파일이 아니라 migration.sql 을 쓰세요.
--
--  [사용법]   Supabase 대시보드 → SQL Editor → 새 쿼리 → 전체 붙여넣기 → Run
--             한 번만 실행하면 됩니다. 여러 번 실행해도 안전합니다.
--
--  [실행 순서] ① 테이블 전부 → ② 함수 → ③ RLS 정책 → ④ 트리거 → ⑤ 기본 데이터
--             (함수가 테이블보다 먼저 오면 "relation does not exist" 에러가 납니다)
-- ============================================================================


-- ██ ① 테이블 ███████████████████████████████████████████████████████████████

-- ── 1. 요금제 등급 ─────────────────────────────────────────────────────────
create table if not exists public.tiers (
  id             text primary key,
  name           text not null,
  max_products   integer not null default 2,
  max_templates  integer not null default 1,
  max_crm_count  integer not null default 20,
  created_at     timestamptz not null default now()
);

insert into public.tiers (id, name, max_products, max_templates, max_crm_count) values
  ('free',   '무료 회원', 2,    1,    20),
  ('silver', '실버 회원', 8,    3,    300),
  ('gold',   '골드 회원', 100,  50,   999999),
  ('admin',  '관리자',    9999, 9999, 999999)
on conflict (id) do nothing;

-- ── 2. 사용자 프로필 ───────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  email                    text,
  tier_id                  text not null default 'free' references public.tiers(id),
  role                     text not null default 'user',
  subscription_start_date  timestamptz,
  subscription_end_date    timestamptz,
  created_at               timestamptz not null default now()
);

-- ── 3. 발주처 (공급업체) ───────────────────────────────────────────────────
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
  -- 제품 매입가가 부가세를 포함한 금액인지 여부 (기본: 포함)
  vat_included   boolean not null default true,
  memo           text,
  created_at     timestamptz not null default now()
);
create unique index if not exists suppliers_user_name_key on public.suppliers (user_id, name);

-- ── 4. 송장 양식 ───────────────────────────────────────────────────────────
create table if not exists public.invoice_templates (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  headers         jsonb not null default '[]'::jsonb,   -- 1행: 주문서 매칭용
  output_headers  jsonb,                                -- 2행: 실제 출력용
  created_at      timestamptz not null default now()
);

-- ── 5. 제품 (SKU) ──────────────────────────────────────────────────────────
create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  sku                 text not null,
  name                text not null,
  additional_name     text,
  use_additional_name boolean not null default false,
  supplier_name       text,                                              -- 표시/하위호환용
  supplier_id         uuid references public.suppliers(id) on delete set null,
  template_id         uuid references public.invoice_templates(id) on delete set null,
  purchase_cost       numeric not null default 0,   -- 매입가 (발주처에 줄 돈)
  sales_price         numeric not null default 0,   -- 판매가
  shipping_cost       numeric not null default 0,
  other_cost          numeric not null default 0,
  market_fee_rate     numeric not null default 0,   -- %
  vat_type            text    not null default 'taxable',
  created_at          timestamptz not null default now(),
  constraint products_vat_type_check check (vat_type in ('taxable', 'exempt'))
);
create unique index if not exists products_user_sku_key on public.products (user_id, sku);
create index if not exists products_supplier_id_idx on public.products (supplier_id);

-- ── 6. 매출/정산 기록 ──────────────────────────────────────────────────────
create table if not exists public.sales_records (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  product_id            uuid references public.products(id) on delete set null,
  product_name          text,
  product_sku           text,
  supplier_name         text,
  supplier_id           uuid references public.suppliers(id) on delete set null,
  order_id              text,
  quantity              integer not null default 1,
  unit_sales_price      numeric not null default 0,
  unit_purchase_cost    numeric not null default 0,
  total_sales_amount    numeric not null default 0,  -- 매출액
  total_purchase_amount numeric not null default 0,  -- 매입액 (부가세 포함 지급액)
  total_supply_amount   numeric not null default 0,  -- 매입 공급가액
  total_vat_amount      numeric not null default 0,  -- 매입 부가세
  total_shipping_cost   numeric not null default 0,
  total_market_fee      numeric not null default 0,
  net_profit            numeric not null default 0,
  order_date            timestamptz not null default now(),
  created_at            timestamptz not null default now()
);
create index if not exists sales_records_user_date_idx on public.sales_records (user_id, order_date desc);

-- 같은 주문이 두 번 저장되는 것을 DB 차원에서도 막는다
create unique index if not exists sales_records_dedup_key
  on public.sales_records (user_id, order_id, supplier_name, product_name)
  where order_id is not null and order_id <> '';

-- ── 7. 앱 설정 (구독 링크, 유튜브 URL, 가격 등) ────────────────────────────
create table if not exists public.app_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('silver_subscription_url', ''), ('gold_subscription_url', ''),
  ('youtube_tutorial_template', ''), ('youtube_tutorial_product', ''), ('youtube_tutorial_convert', ''),
  ('price_silver_original', '11000'), ('price_silver_sale', '5500'),
  ('price_gold_original', '15000'),  ('price_gold_sale', '8800')
on conflict (key) do nothing;

-- ── 8. 활동 로그 ───────────────────────────────────────────────────────────
create table if not exists public.activity_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  action_type text,
  description text,
  created_at  timestamptz not null default now()
);
create index if not exists activity_logs_user_idx on public.activity_logs (user_id, created_at desc);

-- ── 9. 방문/이벤트 통계 (비회원도 기록됨) ──────────────────────────────────
create table if not exists public.analytics_events (
  id         uuid primary key default gen_random_uuid(),
  event_type text not null,
  user_id    uuid references auth.users(id) on delete set null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_created_idx on public.analytics_events (created_at desc);

-- ── 10. 블로그 ─────────────────────────────────────────────────────────────
create table if not exists public.blog_posts (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  slug          text unique not null,
  excerpt       text,
  content       text,
  thumbnail_url text,
  is_published  boolean not null default false,
  author_id     uuid references auth.users(id) on delete set null,
  view_count    integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── 11. 사용 가이드 ────────────────────────────────────────────────────────
create table if not exists public.user_guides (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  slug          text unique not null,
  excerpt       text,
  content       text,
  thumbnail_url text,
  is_published  boolean not null default false,
  sort_order    integer not null default 0,
  author_id     uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);


-- ██ ② 함수 █████████████████████████████████████████████████████████████████

-- 관리자 판별. security definer 라서 RLS를 우회한다.
-- (profiles 정책 안에서 profiles를 다시 조회하면 무한 재귀가 나기 때문에 필요)
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
     where id = auth.uid() and role in ('admin', 'super_admin')
  );
$$;

-- 회원가입 시 프로필 자동 생성 (이게 없으면 로그인해도 등급 정보가 없다)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, tier_id, role)
  values (new.id, new.email, 'free', 'user')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ██ ③ RLS 정책 ████████████████████████████████████████████████████████████
-- anon 키는 공개되어도 되는 키입니다. 그 전제가 바로 아래 정책들입니다.
-- 이걸 끄면 키만으로 남의 데이터가 열립니다.

-- 등급: 누구나 읽기, 관리자만 수정
alter table public.tiers enable row level security;
drop policy if exists "tiers_read_all" on public.tiers;
create policy "tiers_read_all" on public.tiers for select using (true);
drop policy if exists "tiers_admin_write" on public.tiers;
create policy "tiers_admin_write" on public.tiers for all
  using (public.is_admin()) with check (public.is_admin());

-- 프로필: 본인 것만 (관리자는 전체)
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all" on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- 발주처 / 송장양식 / 제품 / 매출기록: 본인 데이터만
alter table public.suppliers enable row level security;
drop policy if exists "suppliers_own_all" on public.suppliers;
create policy "suppliers_own_all" on public.suppliers for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.invoice_templates enable row level security;
drop policy if exists "invoice_templates_own_all" on public.invoice_templates;
create policy "invoice_templates_own_all" on public.invoice_templates for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.products enable row level security;
drop policy if exists "products_own_all" on public.products;
create policy "products_own_all" on public.products for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.sales_records enable row level security;
drop policy if exists "sales_records_own_all" on public.sales_records;
create policy "sales_records_own_all" on public.sales_records for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 앱 설정: 누구나 읽기, 관리자만 수정
alter table public.app_settings enable row level security;
drop policy if exists "app_settings_read_all" on public.app_settings;
create policy "app_settings_read_all" on public.app_settings for select using (true);
drop policy if exists "app_settings_admin_write" on public.app_settings;
create policy "app_settings_admin_write" on public.app_settings for all
  using (public.is_admin()) with check (public.is_admin());

-- 활동 로그: 본인 것만 조회, 본인 id로만 기록
alter table public.activity_logs enable row level security;
drop policy if exists "activity_logs_select_own_or_admin" on public.activity_logs;
create policy "activity_logs_select_own_or_admin" on public.activity_logs
  for select using (auth.uid() = user_id or public.is_admin());
drop policy if exists "activity_logs_insert_own" on public.activity_logs;
create policy "activity_logs_insert_own" on public.activity_logs
  for insert with check (auth.uid() = user_id);

-- 방문 통계: 비회원도 기록 가능, 조회는 관리자만
alter table public.analytics_events enable row level security;
drop policy if exists "analytics_insert_anyone" on public.analytics_events;
create policy "analytics_insert_anyone" on public.analytics_events for insert with check (true);
drop policy if exists "analytics_select_admin" on public.analytics_events;
create policy "analytics_select_admin" on public.analytics_events for select using (public.is_admin());

-- 블로그 / 가이드: 공개된 글은 누구나, 작성은 관리자만
alter table public.blog_posts enable row level security;
drop policy if exists "blog_public_read" on public.blog_posts;
create policy "blog_public_read" on public.blog_posts for select
  using (is_published = true or public.is_admin());
drop policy if exists "blog_admin_write" on public.blog_posts;
create policy "blog_admin_write" on public.blog_posts for all
  using (public.is_admin()) with check (public.is_admin());

alter table public.user_guides enable row level security;
drop policy if exists "guides_public_read" on public.user_guides;
create policy "guides_public_read" on public.user_guides for select
  using (is_published = true or public.is_admin());
drop policy if exists "guides_admin_write" on public.user_guides;
create policy "guides_admin_write" on public.user_guides for all
  using (public.is_admin()) with check (public.is_admin());


-- ██ ④ 이미지 저장소 ███████████████████████████████████████████████████████

insert into storage.buckets (id, name, public)
values ('content-images', 'content-images', true)
on conflict (id) do nothing;

drop policy if exists "content_images_public_read" on storage.objects;
create policy "content_images_public_read" on storage.objects
  for select using (bucket_id = 'content-images');

drop policy if exists "content_images_auth_upload" on storage.objects;
create policy "content_images_auth_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'content-images');


-- ============================================================================
--  ⑤ [마지막] 본인 계정을 관리자로 승격
--
--  1) 앱에서 회원가입을 먼저 하세요 (그래야 auth.users 에 계정이 생깁니다)
--  2) 아래 주석을 풀고 이메일을 본인 것으로 바꿔 실행하세요
-- ============================================================================
-- update public.profiles
--    set role = 'super_admin', tier_id = 'admin'
--  where email = 'ungqum77@gmail.com';


-- ── 확인용 조회 ────────────────────────────────────────────────────────────
-- 테이블 11개와 RLS 상태 점검 (rowsecurity 가 전부 true 여야 정상)
--   select tablename, rowsecurity from pg_tables
--    where schemaname = 'public' order by tablename;

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
