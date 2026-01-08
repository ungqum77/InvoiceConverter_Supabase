
import React, { useState, useEffect, useRef } from 'react';
import { supabase, IS_CONFIG_ERROR, CONFIG_ERROR_MESSAGE } from '../services/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/Button';
import { Lock, Mail, Loader2, AlertTriangle, Info, UserX, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Auth: React.FC = () => {
  const { user, loading: authLoading, isDeletedAccount, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [viewMode, setViewMode] = useState<'login' | 'signup' | 'forgot_password' | 'restore_account' | 'update_password'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success', text: string } | null>(null);

  const hasRedirected = useRef(false);

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (IS_CONFIG_ERROR) {
        setMessage({ type: 'error', text: CONFIG_ERROR_MESSAGE });
        return;
    }

    setLoading(true);
    setMessage(null);

    // Calculate trial end date (3 days from now)
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
              emailRedirectTo: window.location.origin,
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
                redirectTo: window.location.origin + '/#/auth', 
            });
            if (error) throw error;
            setMessage({ type: 'success', text: '비밀번호 초기화 링크를 발송했습니다.' });
        }
      } else {
        // 데모 모드 (실버 3일 체험권 포함)
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

        {message && (
          <div className={`p-4 rounded-lg text-sm mb-6 border ${message.type === 'error' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-green-50 text-green-700 border-green-100'}`}>
             <div className="flex items-center gap-2 text-xs leading-relaxed">
                {message.type === 'error' ? <AlertTriangle size={16}/> : <CheckCircle2 size={16}/>}
                {message.text}
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
            {viewMode === 'login' ? '로그인하기' : viewMode === 'signup' ? '회원가입 완료 (실버 3일 체험)' : '초기화 메일 보내기'}
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
