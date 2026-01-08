import { createClient } from '@supabase/supabase-js';

/**
 * [필독] Supabase 설정 정보
 * URL: https://klxiareqtqvcobdgwswq.supabase.co
 * KEY: 사용자가 제공한 유효한 Anon Key 적용 완료
 */

const SUPABASE_URL: string = 'https://klxiareqtqvcobdgwswq.supabase.co';
// 제공해주신 유효한 키를 적용했습니다.
const SUPABASE_ANON_KEY: string = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGlhcmVxdHF2Y29iZGd3c3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NjEzMzIsImV4cCI6MjA4MzMzNzMzMn0.2MupFqgdvlk9yudS1C73B1gOVHQ5IKhZB5h4Kjnwvr4'; 

// 키 상태 체크 로직
// 1. 비어있거나 초기 안내 문구인 경우
const isPlaceholder = !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY');

// 2. 정상적인 Supabase 키는 eyJ로 시작하는 JWT 형식이어야 함
const isValidFormat = SUPABASE_ANON_KEY.startsWith('eyJ') && SUPABASE_ANON_KEY.split('.').length === 3;

// 3. Stripe 키 오입력 방지
const isStripeKey = SUPABASE_ANON_KEY.startsWith('sb_publishable');

export const IS_CONFIG_ERROR = isPlaceholder || !isValidFormat || isStripeKey;

export const CONFIG_ERROR_MESSAGE = (() => {
    if (isPlaceholder) return 'Supabase API 키가 설정되지 않았습니다.';
    if (isStripeKey) return '입력된 키는 Stripe 결제 키입니다. Supabase Anon 키를 입력해주세요.';
    if (!isValidFormat) return 'Supabase API 키 형식이 올바르지 않습니다 (eyJ... 로 시작하는 키 필요).';
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