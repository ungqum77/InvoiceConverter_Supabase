import { createClient } from '@supabase/supabase-js';

/**
 * [필독] Supabase 설정 정보
 *
 * 접속 정보는 코드에 넣지 않고 환경변수로 관리합니다.
 *  - 로컬: 프로젝트 루트의 `.env.local` (git에 올라가지 않음)
 *  - 배포: Vercel → Settings → Environment Variables
 *
 * 필요한 변수 2개 (Supabase → Project Settings → API 에서 복사)
 *   VITE_SUPABASE_URL       = https://xxxxx.supabase.co
 *   VITE_SUPABASE_ANON_KEY  = 공개용 키
 *
 * 공개용 키는 두 가지 형식이 있습니다. 둘 다 지원합니다.
 *   - 신규: `sb_publishable_...`  (Publishable key)
 *   - 구형: `eyJ...` JWT          (Legacy anon key)
 * 짝이 되는 `sb_secret_...` / `service_role` 키는 서버 전용이며,
 * 브라우저에 넣으면 RLS가 통째로 무시되므로 아래에서 차단합니다.
 *
 * 값을 바꾼 뒤에는 `npm run dev` 를 껐다 다시 켜야 반영됩니다.
 */

const SUPABASE_URL: string = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const SUPABASE_ANON_KEY: string = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

// ── URL 검사 ───────────────────────────────────────────────────────────────
const isUrlMissing = !SUPABASE_URL;
const isUrlInvalid = !isUrlMissing && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(SUPABASE_URL);

// ── 키 검사 ────────────────────────────────────────────────────────────────
// 1. 비어있거나 초기 안내 문구인 경우
const isPlaceholder = !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY');

// 2. 신규 형식 (Publishable key)
const isPublishableKey = SUPABASE_ANON_KEY.startsWith('sb_publishable_');

// 3. 구형 형식 (Legacy anon key = JWT)
const isJwt = SUPABASE_ANON_KEY.startsWith('eyJ') && SUPABASE_ANON_KEY.split('.').length === 3;

// 4. 서버 전용 키 차단 — 유출되면 RLS가 무력화되어 DB 전체가 열립니다
const isSecretKey = SUPABASE_ANON_KEY.startsWith('sb_secret_');
const isServiceRoleJwt = (() => {
    if (!isJwt) return false;
    try {
        return JSON.parse(atob(SUPABASE_ANON_KEY.split('.')[1])).role === 'service_role';
    } catch {
        return false;
    }
})();

// 5. Stripe 키 오입력 방지
const isStripeKey = /^(pk|sk)_(live|test)_/.test(SUPABASE_ANON_KEY);

const isValidFormat = isPublishableKey || isJwt;

export const IS_CONFIG_ERROR =
    isUrlMissing || isUrlInvalid || isPlaceholder ||
    isSecretKey || isServiceRoleJwt || isStripeKey || !isValidFormat;

export const CONFIG_ERROR_MESSAGE = (() => {
    const hint = ' (.env.local 파일을 확인한 뒤 개발 서버를 재시작해주세요)';
    if (isUrlMissing) return 'VITE_SUPABASE_URL 환경변수가 설정되지 않았습니다.' + hint;
    if (isUrlInvalid) return 'VITE_SUPABASE_URL 형식이 올바르지 않습니다 (https://xxxxx.supabase.co).' + hint;
    if (isPlaceholder) return 'VITE_SUPABASE_ANON_KEY 환경변수가 설정되지 않았습니다.' + hint;
    if (isSecretKey) return '입력된 키는 서버 전용 secret 키입니다. 절대 사용하지 마시고 Publishable 키를 입력해주세요.';
    if (isServiceRoleJwt) return '입력된 키는 service_role 키입니다. 절대 사용하지 마시고 anon 키를 입력해주세요.';
    if (isStripeKey) return '입력된 키는 Stripe 결제 키입니다. Supabase 공개 키를 입력해주세요.';
    if (!isValidFormat) return 'Supabase API 키 형식이 올바르지 않습니다 (sb_publishable_... 또는 eyJ... 형식).' + hint;
    return '';
})();

// 안전하게 클라이언트 생성
let supabaseInstance = null;
if (!IS_CONFIG_ERROR) {
  try {
    supabaseInstance = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    });
  } catch (e) {
    console.error("Supabase 초기화 실패:", e);
  }
}

export const supabase = supabaseInstance;
export const isSupabaseConfigured = !!supabase;
