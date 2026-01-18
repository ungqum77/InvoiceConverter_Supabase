import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Package, Settings, FileText, Home, LogOut, User as UserIcon, LogIn, ShieldAlert, Menu, X, LayoutDashboard, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const APP_VERSION = "v24.05.22.18.35";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 모바일 메뉴 오픈 시 바디 스크롤 잠금 (배경 고정)
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none'; // iOS 등에서 터치 스크롤 방지
    } else {
      document.body.style.overflow = 'unset';
      document.body.style.touchAction = 'auto';
    }
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.touchAction = 'auto';
    };
  }, [isMobileMenuOpen]);

  const isActive = (path: string) => {
    return location.pathname === path 
      ? "text-primary bg-primary-light font-black border-l-4 border-primary" 
      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium border-l-4 border-transparent";
  };

  const handleSignOut = async () => {
    if (window.confirm("로그아웃 하시겠습니까?")) {
      await signOut();
      setIsMobileMenuOpen(false);
      navigate('/');
    }
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className="sticky top-0 z-[100] w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* 로고 영역 */}
          <div className="flex items-end gap-1">
            <Link to="/" className="flex items-center gap-2 shrink-0 group" onClick={closeMobileMenu}>
              <div className="bg-primary p-2 rounded-xl text-white shadow-lg shadow-primary/20 group-hover:rotate-3 transition-transform">
                <Package size={20} strokeWidth={3} />
              </div>
              <span className="text-xl font-[1000] tracking-tighter text-slate-900 sm:text-2xl">송장.com</span>
            </Link>
          </div>

          {/* 데스크탑 메뉴 */}
          <div className="hidden md:flex items-center gap-1">
            <Link to="/" className={`px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2 ${isActive('/')}`}>
              <Home size={18} /> 홈
            </Link>
            {user && (
              <>
                <Link to="/products" className={`px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2 ${isActive('/products')}`}>
                  <Settings size={18} /> 제품 관리
                </Link>
                <Link to="/convert" className={`px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2 ${isActive('/convert')}`}>
                  <FileText size={18} /> 송장 변환
                </Link>
              </>
            )}
            {isAdmin && (
                <Link to="/admin" className={`px-3 py-1.5 rounded-xl text-sm transition-all flex items-center gap-2 ${isActive('/admin')} border border-red-100 text-red-600 bg-red-50/50`}>
                  <ShieldAlert size={16} /> 관리자
                </Link>
            )}
          </div>

          {/* 우측 버튼 영역 */}
          <div className="flex items-center gap-2">
             {user ? (
               <div className="flex items-center gap-2">
                 <button 
                   onClick={() => { closeMobileMenu(); navigate('/products?tab=account'); }}
                   className="hidden sm:flex items-center gap-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition-all font-bold"
                 >
                   <UserIcon size={14} />
                   <span className="max-w-[120px] truncate">{user.email?.split('@')[0]}님</span>
                 </button>
                 
                 <button onClick={toggleMobileMenu} className="p-2.5 text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors">
                   {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                 </button>
               </div>
             ) : (
               <Link to="/auth" className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-black hover:bg-primary-hover transition-all">
                 <LogIn size={18} /> 로그인
               </Link>
             )}
          </div>
        </div>
      </div>

      {/* 모바일 전체화면 메뉴 */}
      {isMobileMenuOpen && (
        <>
          {/* 어두운 배경 오버레이 */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] animate-in fade-in duration-300"
            onClick={closeMobileMenu}
          />
          
          {/* 메뉴 컨테이너 (우측에서 슬라이드) */}
          <div className="fixed inset-y-0 right-0 w-[85%] max-w-sm z-[120] bg-white shadow-[-20px_0_50px_rgba(0,0,0,0.2)] animate-in slide-in-from-right duration-300 flex flex-col h-full outline-none">
            
            {/* 메뉴 헤더: 닫기 및 사용자 정보 */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center border border-primary/20">
                  <UserIcon size={20} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Signed in as</p>
                  <p className="text-sm font-black text-slate-900 truncate max-w-[150px]">{user?.email}</p>
                </div>
              </div>
              <button onClick={closeMobileMenu} className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-lg border border-slate-200 shadow-sm">
                <X size={20} />
              </button>
            </div>

            {/* 메뉴 본문: 네비게이션 링크 (스크롤 가능) */}
            <div className="flex-1 overflow-y-auto py-4">
              <div className="px-4 mb-2">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-2">Main Navigation</p>
                <div className="space-y-1">
                  <Link to="/" onClick={closeMobileMenu} className={`flex items-center justify-between w-full px-4 py-4 rounded-xl text-base ${isActive('/')}`}>
                    <div className="flex items-center gap-4"><Home size={20} /> <span>홈 화면</span></div>
                    <ChevronRight size={16} className="opacity-30" />
                  </Link>
                  {user && (
                    <>
                      <Link to="/products" onClick={closeMobileMenu} className={`flex items-center justify-between w-full px-4 py-4 rounded-xl text-base ${isActive('/products')}`}>
                        <div className="flex items-center gap-4"><Settings size={20} /> <span>제품 관리</span></div>
                        <ChevronRight size={16} className="opacity-30" />
                      </Link>
                      <Link to="/convert" onClick={closeMobileMenu} className={`flex items-center justify-between w-full px-4 py-4 rounded-xl text-base ${isActive('/convert')}`}>
                        <div className="flex items-center gap-4"><FileText size={20} /> <span>송장 변환</span></div>
                        <ChevronRight size={16} className="opacity-30" />
                      </Link>
                    </>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="px-4 mt-6">
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-2 px-2">Administrator</p>
                  <Link to="/admin" onClick={closeMobileMenu} className={`flex items-center justify-between w-full px-4 py-4 rounded-xl text-base ${isActive('/admin')} bg-red-50/50 text-red-600`}>
                    <div className="flex items-center gap-4"><LayoutDashboard size={20} /> <span>관리자 모드</span></div>
                    <ChevronRight size={16} className="opacity-30" />
                  </Link>
                </div>
              )}
            </div>
            
            {/* 메뉴 푸터: 버전 및 로그아웃 */}
            <div className="p-6 bg-slate-900 text-white">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Application Version</span>
                <span className="text-[10px] font-mono text-primary-light font-bold">{APP_VERSION}</span>
              </div>
              <button 
                onClick={handleSignOut} 
                className="w-full py-4 bg-white/10 hover:bg-white/20 text-white border border-white/10 rounded-2xl font-black flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
              >
                <LogOut size={20} /> 로그아웃
              </button>
            </div>
          </div>
        </>
      )}
    </nav>
  );
};