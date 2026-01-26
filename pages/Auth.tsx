import React, { useState, useEffect, useRef } from 'react';
import { supabase, IS_CONFIG_ERROR, CONFIG_ERROR_MESSAGE } from '../services/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/Button';
import { Lock, Mail, Loader2, AlertTriangle, UserX, AlertCircle, Copy, Check, ExternalLink, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Auth: React.FC = () => {
  const { user, loading: authLoading, isDeletedAccount, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [viewMode, setViewMode] = useState<'login' | 'signup' | 'forgot_password' | 'restore_account' | 'update_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isProcessingHash, setIsProcessingHash] = useState(false);

  const hasRedirected = useRef(false);

  // 현재 브라우저의 정확한 주소 (예: http://localhost:3000)
  const currentOrigin = window.location.origin;
  const currentPort = window.location.port || '80';
  // 5173포트가 아니고 로컬호스트인 경우 경고 표시
  const isPortMismatch = currentPort !== '5173' && window.location.hostname === 'localhost' && !IS_CONFIG_ERROR;

  // URL Hash에 access_token이 있으면 '로그인 처리 중' 상태로 전환
  useEffect(() => {
    if (location.hash && location.hash.includes('access_token')) {
        setIsProcessingHash(true);
        setLoading(true);
    }
  }, [location]);

  useEffect(() => {
    if (!authLoading && user && !isDeletedAccount && !hasRedirected.current) {
        if (viewMode !== 'update_password') {
            hasRedirected.current = true;
            navigate('/', { replace: true });
        }
    } else if (user && isDeletedAccount) {
        setViewMode('restore_account');
    }
  }, [user, authLoading, isDeletedAccount, navigate, viewMode]);

  const handleGoogleLogin = async () => {
    if (IS_CONFIG_ERROR) {
        setMessage({ type: 'error', text: CONFIG_ERROR_MESSAGE });
        return;
    }
    setLoading(true);
    try {
        if (supabase) {
            console.log("Google Login Redirecting to:", currentOrigin);
            
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    // 중요: 현재 브라우저의 주소로 명시적 리다이렉트 지정
                    redirectTo: currentOrigin,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    },
                },
            });
            if (error) throw error;
        } else {
            setMessage({ type: 'error', text: 'Supabase 설정이 필요합니다.' });
            setLoading(false);
        }
    } catch (error: any) {
        console.error("Google Auth Error:", error);
        let msg = error.message || '구글 로그인 중 오류가 발생했습니다.';
        
        if (msg.includes('provider is not enabled')) {
            msg = 'Supabase 대시보드에서 Google 로그인을 활성화해주세요 (Authentication > Providers).';
        } else if (msg.includes('Client ID')) {
            msg = 'Google Client ID 설정이 필요합니다.';
        }

        setMessage({ type: 'error', text: msg });
        setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (IS_CONFIG_ERROR) {
        setMessage({ type: 'error', text: CONFIG_ERROR_MESSAGE });
        return;
    }

    setLoading(true);
    setMessage(null);

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 3);

    try {
      if (supabase) {
        if (viewMode === 'login') {
          const { error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) throw error;
        } else if (viewMode === 'signup') {
          const { error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: { 
              emailRedirectTo: currentOrigin,
              data: {
                tier_id: 'silver',
                subscription_end_date: trialEndDate.toISOString()
              }
            }
          });
          if (error) throw error;
          setMessage({ type: 'success', text: '인증 메일을 발송했습니다. 메일 확인 후 로그인하면 실버 등급 3일 체험권이 적용됩니다.' });
        } else if (viewMode === 'forgot_password') {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: currentOrigin + '/#/auth', 
            });
            if (error) throw error;
            setMessage({ type: 'success', text: '비밀번호 초기화 링크를 발송했습니다.' });
        }
      } else {
        await new Promise(r => setTimeout(r, 800)); 
        const demoUser = {
            id: 'demo-' + Math.random().toString(36).substr(2, 9),
            email: email || 'demo@example.com',
            user_metadata: { 
              status: 'active',
              tier_id: 'silver',
              subscription_end_date: trialEndDate.toISOString()
            }
        };
        localStorage.setItem('demo_user', JSON.stringify(demoUser));
        window.location.reload(); 
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      setMessage({ type: 'error', text: error.message || '오류가 발생했습니다.' });
    } finally {
      setLoading(false);
    }
  };

  const copyOrigin = () => {
      navigator.clipboard.writeText(currentOrigin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
  };

  if (viewMode === 'restore_account') {
      return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center border border-red-100">
                <UserX size={48} className="mx-auto text-red-500 mb-4" />
                <h2 className="text-2xl font-bold mb-4 text-slate-900">탈퇴 처리된 계정입니다</h2>
                <p className="text-slate-500 mb-6 text-sm">이 계정은 더 이상 사용할 수 없습니다. 관리자에게 문의하세요.</p>
                <Button onClick={signOut} className="w-full">로그아웃 후 다른 계정으로 로그인</Button>
            </div>
        </div>
      );
  }

  // 로그인 성공 후 리다이렉트 처리 중일 때
  if (isProcessingHash || (loading && !message)) {
      return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4">
           <div className="text-center">
              <Loader2 className="animate-spin text-primary mx-auto mb-4" size={48} />
              <h2 className="text-xl font-bold text-slate-900">로그인 정보를 확인 중입니다...</h2>
              <p className="text-slate-500 text-sm mt-2">잠시만 기다려주세요.</p>
           </div>
        </div>
      );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-slate-50">
      <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl border border-slate-200">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-slate-900">
            {viewMode === 'login' ? '로그인' : viewMode === 'signup' ? '회원가입' : '비밀번호 찾기'}
          </h2>
          <p className="text-slate-500 mt-2 text-sm">InvoiceConverter Pro에 오신 것을 환영합니다.</p>
        </div>

        {IS_CONFIG_ERROR && (
           <div className="mb-6 p-4 bg-red-50 text-red-800 rounded-lg text-xs flex gap-2 border border-red-100 items-start">
             <AlertCircle size={16} className="shrink-0 mt-0.5" />
             <div>{CONFIG_ERROR_MESSAGE}</div>
           </div>
        )}

        {/* 중요: 포트 불일치 경고 (3000번 등에서 실행 시) */}
        {isPortMismatch && (
            <div className="mb-6 p-5 bg-amber-50 text-amber-900 rounded-xl text-xs border-2 border-amber-200 leading-relaxed shadow-sm relative overflow-hidden">
                <div className="flex items-start gap-2 mb-3 z-10 relative">
                    <div className="p-1.5 bg-amber-100 rounded text-amber-700 mt-1"><Globe size={18} /></div>
                    <div>
                        <div className="font-bold text-sm text-amber-800">Supabase 설정 확인 필요</div>
                        <div className="text-amber-800 mt-1">
                            현재 <b>{currentPort}번 포트</b>에서 실행 중입니다.<br/>
                            로그인 후 <b>5173번 포트</b>로 튕기지 않으려면 설정이 필요합니다.
                        </div>
                    </div>
                </div>
                
                <div className="bg-white/60 p-3 rounded-lg border border-amber-100 mb-3 space-y-2">
                    <div>
                        <p className="mb-1 text-slate-500 font-bold text-[10px] uppercase">1. 이 주소를 복사하세요</p>
                        <div className="flex items-center gap-2">
                            <code className="flex-1 bg-white border border-slate-200 px-2 py-1.5 rounded text-slate-700 font-mono font-bold text-xs">{currentOrigin}</code>
                            <button onClick={copyOrigin} className="p-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded text-slate-500 transition-colors" title="주소 복사">
                                {copied ? <Check size={14} className="text-green-600"/> : <Copy size={14}/>}
                            </button>
                        </div>
                    </div>
                    <div>
                        <p className="mb-1 text-slate-500 font-bold text-[10px] uppercase">2. Supabase Site URL 변경</p>
                        <p className="text-[11px] text-slate-600">Authentication {'>'} URL Configuration {'>'} <b>Site URL</b></p>
                    </div>
                </div>

                <div className="text-amber-800 pl-1 font-medium flex items-center gap-1.5">
                   <AlertTriangle size={14} className="text-amber-600"/>
                   <span>Site URL을 위 주소로 변경해야 오류가 해결됩니다.</span>
                </div>
            </div>
        )}

        {message && (
          <div className={`p-4 rounded-lg text-sm mb-6 border ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
             <div className="flex items-center gap-2 text-xs leading-relaxed">
                {message.type === 'error' ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>}
                {message.text}
             </div>
          </div>
        )}

        {viewMode !== 'forgot_password' && (
            <div className="mb-6">
                <button 
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2.5 bg-white text-slate-700 border border-slate-300 rounded-lg py-3 text-sm font-bold hover:bg-slate-50 hover:shadow-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed group"
                >
                    <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Google 계정으로 계속하기
                </button>
                <div className="relative mt-6">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                    <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-slate-400 font-medium">또는 이메일로 시작</span></div>
                </div>
            </div>
        )}
        
        <form className="space-y-4" onSubmit={handleAuth}>
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">이메일 주소</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                required
                className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                placeholder="example@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          
          {viewMode !== 'forgot_password' && (
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1">비밀번호</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  required
                  className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full py-3 shadow-lg shadow-primary/20" isLoading={loading}>
            {viewMode === 'login' ? '이메일로 로그인' : viewMode === 'signup' ? '이메일로 회원가입 (실버 3일 체험)' : '초기화 메일 보내기'}
          </Button>
        </form>

        <div className="text-center mt-6 pt-4 border-t border-slate-100 space-y-3">
            <button 
                type="button"
                onClick={() => setViewMode(viewMode === 'login' ? 'signup' : 'login')} 
                className="text-sm text-primary font-bold hover:underline"
            >
                {viewMode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
            </button>
            {viewMode === 'login' && (
                <div>
                    <button 
                        type="button"
                        onClick={() => setViewMode('forgot_password')} 
                        className="text-xs text-slate-400 hover:text-slate-600"
                    >
                        비밀번호를 잊어버리셨나요?
                    </button>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

function CheckCircle2({ size }: { size: number }) {
    return <div className="text-green-500"><svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>;
}