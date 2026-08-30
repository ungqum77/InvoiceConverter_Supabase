// 송장.com — Supabase 연결/스키마 점검 스크립트
//
//   node db-check.mjs                              기본 점검
//   node db-check.mjs --signup you+test@gmail.com  회원가입 트리거까지 실검증
//
// .env.local 의 VITE_SUPABASE_* 값을 읽기만 합니다. 파일을 고치지 않습니다.
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// ── .env.local 로드 ────────────────────────────────────────────────────────
const env = {};
for (const line of fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
  if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
}
const URL = env.VITE_SUPABASE_URL, KEY = env.VITE_SUPABASE_ANON_KEY;

const pass = [], fail = [], warn = [];
const ok = (m) => { pass.push(m); console.log('  \x1b[32m✓\x1b[0m ' + m); };
const no = (m) => { fail.push(m); console.log('  \x1b[31m✗\x1b[0m ' + m); };
const wr = (m) => { warn.push(m); console.log('  \x1b[33m!\x1b[0m ' + m); };
const head = (t) => console.log('\n' + t);

// ── 0. 환경변수 ────────────────────────────────────────────────────────────
head('[0] 환경변수');
if (!URL) no('VITE_SUPABASE_URL 없음');
else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(URL)) no(`URL 형식 이상: ${URL}`);
else ok(`URL: ${URL}`);

if (!KEY) no('VITE_SUPABASE_ANON_KEY 없음');
else if (KEY.startsWith('sb_secret_')) no('!!! 서버 전용 secret 키입니다. Publishable 키로 교체하세요 !!!');
else if (/^(pk|sk)_(live|test)_/.test(KEY)) no('Stripe 키가 들어있습니다. Supabase 공개 키로 교체하세요');
else if (KEY.startsWith('sb_publishable_')) ok('Publishable 키 (신규 형식) 정상');
else if (KEY.startsWith('eyJ') && KEY.split('.').length === 3) {
  const j = JSON.parse(Buffer.from(KEY.split('.')[1], 'base64').toString());
  if (j.role === 'service_role') no('!!! service_role 키입니다. 즉시 anon 키로 교체하세요 !!!');
  else if (j.role !== 'anon') wr(`키 role 이 예상과 다름: ${j.role}`);
  else ok(`anon 키 (구형 JWT) 정상 — ref: ${j.ref}, 만료: ${new Date(j.exp * 1000).toISOString().slice(0, 10)}`);
  if (j.ref && URL && !URL.includes(j.ref)) no(`URL과 키의 프로젝트가 다릅니다 (URL≠${j.ref})`);
} else no('키 형식을 알 수 없습니다 (sb_publishable_... 또는 eyJ... 이어야 합니다)');

if (fail.length) { console.log('\n환경변수부터 고쳐야 합니다.\n'); process.exit(1); }

const db = createClient(URL, KEY, { auth: { persistSession: false } });

// ── 1. 테이블 11개 ─────────────────────────────────────────────────────────
head('[1] 테이블 (STEP 2 스키마 실행 여부)');
const TABLES = ['tiers', 'profiles', 'suppliers', 'invoice_templates', 'products',
                'sales_records', 'app_settings', 'activity_logs', 'analytics_events',
                'blog_posts', 'user_guides'];
for (const t of TABLES) {
  const { error } = await db.from(t).select('*', { count: 'exact', head: true });
  if (error && (error.code === '42P01' || /does not exist/i.test(error.message))) no(`${t} — 테이블 없음`);
  else if (error && error.code === '42501') ok(`${t} — 존재 (RLS 차단, 정상)`);
  else if (error) wr(`${t} — ${error.code}: ${error.message}`);
  else ok(`${t} — 존재`);
}

// ── 2. 기본 데이터 ─────────────────────────────────────────────────────────
head('[2] 기본 데이터');
const { data: tiers, error: te } = await db.from('tiers').select('id,name,max_products').order('max_products');
if (te) no(`tiers 조회 실패: ${te.message}`);
else if (tiers.length < 4) no(`tiers 가 ${tiers.length}개 (4개여야 함: free/silver/gold/admin)`);
else ok(`요금제 ${tiers.length}개: ` + tiers.map(t => `${t.id}(${t.max_products})`).join(', '));

const { data: st, error: se } = await db.from('app_settings').select('key');
if (se) no(`app_settings 조회 실패: ${se.message}`);
else if (st.length < 9) wr(`app_settings ${st.length}개 (기본 9개 예상)`);
else ok(`app_settings ${st.length}개`);

// ── 3. RLS 동작 ────────────────────────────────────────────────────────────
head('[3] RLS (비로그인 키로 남의 데이터가 안 보여야 함)');
for (const t of ['products', 'suppliers', 'invoice_templates', 'sales_records', 'profiles']) {
  const { data, error } = await db.from(t).select('id').limit(1);
  if (error) ok(`${t} — 비로그인 조회 차단됨 (${error.code})`);
  else if (data.length === 0) ok(`${t} — 비로그인 조회 시 0행 (정상)`);
  else no(`${t} — 비로그인인데 ${data.length}행이 보입니다! RLS 확인 필요`);
}
const { error: ie } = await db.from('products').insert({ sku: '__rls_test__', name: 'x' });
if (ie) ok(`products 비로그인 쓰기 차단됨 (${ie.code})`);
else {
  no('products 에 비로그인 INSERT 가 성공했습니다! RLS 정책 확인 필요');
  await db.from('products').delete().eq('sku', '__rls_test__');
}

// ── 4. 함수 · 스토리지 ─────────────────────────────────────────────────────
head('[4] 함수 · 스토리지');
const { data: adm, error: ae } = await db.rpc('is_admin');
if (ae) no(`is_admin() 없음/오류: ${ae.message}`);
else ok(`is_admin() 동작 (비로그인 → ${adm})`);

// listBuckets 는 비로그인 키면 항상 빈 배열이라 판별에 쓸 수 없다.
// 공개 객체 요청의 에러 코드로 구분한다 (NoSuchKey = 버킷 있음 / NoSuchBucket = 없음)
const probe = await fetch(`${URL}/storage/v1/object/public/content-images/__probe__.png`);
const probeBody = await probe.text();
if (/NoSuchBucket|Bucket not found/i.test(probeBody)) no('스토리지 버킷 content-images 없음');
else if (/NoSuchKey|Object not found/i.test(probeBody)) ok('스토리지 버킷 content-images 존재 · 공개 읽기 정상');
else wr(`스토리지 응답 해석 불가: HTTP ${probe.status} ${probeBody.slice(0, 120)}`);

// ── 5. 가입 계정 ───────────────────────────────────────────────────────────
head('[5] 계정 (STEP 5~6)');
const { count: pc, error: pe } = await db.from('profiles').select('*', { count: 'exact', head: true });
if (pe) wr('profiles 카운트 불가 (RLS가 막는 중일 수 있음)');
else if (pc === 0) wr('profiles 가 비로그인 기준 0행 — RLS 때문에 정상. 실제 확인은 [6] 또는 STEP 5에서');
else ok(`profiles ${pc}행`);

// ── 6. 회원가입 트리거 실검증 (--signup 옵션을 줄 때만) ────────────────────
if (process.argv.includes('--signup')) {
  head('[6] 회원가입 트리거 실검증');
  const addr = process.argv[process.argv.indexOf('--signup') + 1];
  if (!addr || addr.startsWith('--')) {
    no('테스트할 이메일을 주세요: node db-check.mjs --signup you+test@gmail.com');
  } else {
    const pw = 'Test!' + Math.random().toString(36).slice(2, 10) + 'Aa1';
    const { data: su, error: sue } = await db.auth.signUp({ email: addr, password: pw });
    if (sue) {
      no(`가입 실패: ${sue.message}`);
    } else if (!su.session) {
      ok(`auth.users 에 계정 생성됨 (id: ${String(su.user?.id).slice(0, 8)}…)`);
      wr(`세션 없음 → 이메일 인증(Confirm email)이 켜져 있습니다. ${addr} 메일함의 링크를 눌러야 로그인됩니다`);
      console.log(`     인증 링크를 누른 뒤 아래로 트리거까지 확인할 수 있습니다:`);
      console.log(`     node db-check.mjs --login ${addr} '${pw}'`);
    } else {
      ok('가입 + 자동 로그인 성공 (이메일 인증 꺼져 있음)');
      const { data: me, error: mee } = await db.from('profiles').select('*').eq('id', su.user.id).maybeSingle();
      if (mee) no(`profiles 조회 실패: ${mee.message}`);
      else if (!me) no('profiles 에 행이 없습니다 → handle_new_user 트리거가 동작하지 않았습니다');
      else ok(`트리거 정상 — profiles 행 생성됨 (tier: ${me.tier_id}, role: ${me.role})`);

      const { error: w1 } = await db.from('products').insert({ user_id: su.user.id, sku: '__t1__', name: 'test1' });
      if (w1) {
        no(`로그인 상태인데 본인 제품 등록 실패: ${w1.message}`);
      } else {
        ok('로그인 상태에서 본인 제품 등록 성공 (RLS write 정상)');
        await db.from('products').delete().eq('user_id', su.user.id).eq('sku', '__t1__');
      }
      await db.auth.signOut();
    }
    wr(`테스트 계정 ${addr} 은 Supabase → Authentication → Users 에서 지우세요`);
  }
}

// ── 7. 로그인 후 검증 (--login 이메일 비밀번호) ────────────────────────────
// 이메일 인증을 마친 계정으로 로그인해서 트리거·RLS write 까지 확인한다.
if (process.argv.includes('--login')) {
  head('[7] 로그인 후 검증');
  const i = process.argv.indexOf('--login');
  const [addr, pw] = [process.argv[i + 1], process.argv[i + 2]];
  if (!addr || !pw) {
    no('사용법: node db-check.mjs --login you@gmail.com 비밀번호');
  } else {
    const { data: si, error: sie } = await db.auth.signInWithPassword({ email: addr, password: pw });
    if (sie) {
      no(`로그인 실패: ${sie.message}` + (/not confirmed/i.test(sie.message) ? ' (메일함의 인증 링크를 먼저 누르세요)' : ''));
    } else {
      ok(`로그인 성공 (${addr})`);
      const { data: me, error: mee } = await db.from('profiles').select('*').eq('id', si.user.id).maybeSingle();
      if (mee) no(`profiles 조회 실패: ${mee.message}`);
      else if (!me) no('profiles 에 행이 없습니다 → handle_new_user 트리거가 동작하지 않았습니다');
      else ok(`트리거 정상 — profiles 행 존재 (tier: ${me.tier_id}, role: ${me.role})`);

      const { error: w1 } = await db.from('products').insert({ user_id: si.user.id, sku: '__t1__', name: 'test1' });
      if (w1) {
        no(`로그인 상태인데 본인 제품 등록 실패: ${w1.message}`);
      } else {
        ok('로그인 상태에서 본인 제품 등록 성공 (RLS write 정상)');
        await db.from('products').delete().eq('user_id', si.user.id).eq('sku', '__t1__');
      }
      await db.auth.signOut();
    }
  }
}

// ── 결과 ───────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`통과 ${pass.length} · 경고 ${warn.length} · 실패 ${fail.length}`);
if (fail.length) { console.log('\n실패 항목:'); fail.forEach(f => console.log('  ✗ ' + f)); }
if (warn.length) { console.log('\n확인 필요:'); warn.forEach(f => console.log('  ! ' + f)); }
console.log(fail.length ? '\n→ 위 항목을 저에게 알려주세요.\n' : '\n→ DB 세팅 정상입니다.\n');
process.exit(fail.length ? 1 : 0);
