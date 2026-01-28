
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Package, Settings, FileText, Home, LogOut, User as UserIcon, LogIn, ShieldAlert, Menu, X, LayoutDashboard, ChevronRight, TrendingUp, BookOpen, HelpCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './Button';

const APP_VERSION = "v24.06.01.CRM";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
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
      ? "text-primary bg-primary-light font-black border-primary" 
      : "text-slate-600 hover:text-slate-900 bg-white font-medium border-slate-100";
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
    <nav className="sticky top-0 z-[100] w-full bg-white border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 shrink-0 group" onClick={closeMobileMenu}>
              <div className="bg-primary p-2 rounded-xl text-white shadow-lg shadow-primary/20 group-hover:rotate-3 transition-transform">
                <Package size={20} strokeWidth={3} />
              </div>
              <span className="text-xl font-[1000] tracking-tighter text-slate-900 sm:text-2xl">송장.com</span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-1">
            <Link to="/" className={`px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2 ${isActive('/')} border`}>
              <Home size={18} /> 홈
            </Link>
            <Link to="/guides" className={`px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2 ${isActive('/guides')} border`}>
              <HelpCircle size={18} /> 사용설명서
            </Link>
            <Link to="/blog" className={`px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2 ${isActive('/blog')} border`}>
              <BookOpen size={18} /> 블로그
            </Link>
            {user && (
              <>
                <Link to="/products" className={`px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2 ${isActive('/products')} border`}>
                  <Settings size={18} /> 제품 관리
                </Link>
                <Link to="/convert" className={`px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2 ${isActive('/convert')} border`}>
                  <FileText size={18} /> 송장 변환
                </Link>
                <Link to="/crm" className={`px-4 py-2 rounded-xl text-sm transition-all flex items-center gap-2 ${isActive('/crm')} border`}>
                  <TrendingUp size={18} /> 매출 CRM
                </Link>
              </>
            )}
            {isAdmin && (
                <Link to="/admin" className={`px-3 py-1.5 rounded-xl text-sm transition-all flex items-center gap-2 ${isActive('/admin')} border border-red-100 text-red-600 bg-red-50/50`}>
                  <ShieldAlert size={16} /> 관리자
                </Link>
            )}
          </div>

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
                 
                 <button onClick={toggleMobileMenu} className="p-2.5 text-slate-700 bg-white hover:bg-slate-50 rounded-xl border border-slate-200 transition-colors md:hidden">
                   {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                 </button>

                 <button onClick={handleSignOut} className="hidden md:flex p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">
                    <LogOut size={22} />
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

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[150] bg-white flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div className="flex h-16 items-center justify-between px-6 border-b border-slate-100 bg-white">
            <div className="flex items-center gap-2">
              <div className="bg-primary p-2 rounded-lg text-white">
                <Package size={18} strokeWidth={3} />
              </div>
              <span className="font-black text-slate-900 tracking-tighter">전체 메뉴</span>
            </div>
            <button onClick={closeMobileMenu} className="p-2 text-slate-500 hover:text-slate-900">
              <X size={24} />
            </button>
          </div>

          <div className="p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-64px)]">
            {user && (
                <div className="mb-6 p-4 bg-slate-50 rounded-2xl flex items-center justify-between border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 border border-slate-200"><UserIcon size={20}/></div>
                        <div>
                            <div className="text-sm font-bold text-slate-900">{user.email?.split('@')[0]}님</div>
                            <button onClick={() => { closeMobileMenu(); navigate('/products?tab=account'); }} className="text-xs text-primary font-bold hover:underline">내 정보 관리</button>
                        </div>
                    </div>
                    <button onClick={handleSignOut} className="p-2 text-slate-400 hover:text-red-500"><LogOut size={20}/></button>
                </div>
            )}

            <Link to="/" onClick={closeMobileMenu} className="flex items-center gap-3 p-4 rounded-xl text-slate-700 hover:bg-slate-50 font-bold transition-colors">
              <Home size={20} className="text-slate-400"/> 홈
            </Link>
             <Link to="/guides" onClick={closeMobileMenu} className="flex items-center gap-3 p-4 rounded-xl text-slate-700 hover:bg-slate-50 font-bold transition-colors">
              <HelpCircle size={20} className="text-slate-400"/> 사용설명서
            </Link>
            <Link to="/blog" onClick={closeMobileMenu} className="flex items-center gap-3 p-4 rounded-xl text-slate-700 hover:bg-slate-50 font-bold transition-colors">
              <BookOpen size={20} className="text-slate-400"/> 블로그
            </Link>

            {user && (
              <>
                <div className="my-2 border-t border-slate-100"></div>
                <div className="px-4 py-2 text-xs font-black text-slate-400 uppercase tracking-wider">서비스</div>
                <Link to="/products" onClick={closeMobileMenu} className="flex items-center gap-3 p-4 rounded-xl text-slate-700 hover:bg-slate-50 font-bold transition-colors">
                  <Settings size={20} className="text-slate-400"/> 제품 관리
                </Link>
                <Link to="/convert" onClick={closeMobileMenu} className="flex items-center gap-3 p-4 rounded-xl text-slate-700 hover:bg-slate-50 font-bold transition-colors">
                  <FileText size={20} className="text-slate-400"/> 송장 변환
                </Link>
                <Link to="/crm" onClick={closeMobileMenu} className="flex items-center gap-3 p-4 rounded-xl text-slate-700 hover:bg-slate-50 font-bold transition-colors">
                  <TrendingUp size={20} className="text-slate-400"/> 매출 CRM
                </Link>
              </>
            )}

            {isAdmin && (
               <>
                 <div className="my-2 border-t border-slate-100"></div>
                 <Link to="/admin" onClick={closeMobileMenu} className="flex items-center gap-3 p-4 rounded-xl text-red-600 bg-red-50 hover:bg-red-100 font-bold transition-colors border border-red-100">
                    <ShieldAlert size={20}/> 관리자 페이지
                 </Link>
               </>
            )}

            {!user && (
              <div className="pt-4 mt-4 border-t border-slate-100">
                <Link to="/auth" onClick={closeMobileMenu} className="flex items-center justify-center gap-2 w-full p-4 bg-primary text-white rounded-xl font-bold shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all">
                  <LogIn size={20} /> 로그인 / 회원가입
                </Link>
              </div>
            )}
            
            <div className="mt-8 text-center">
                <p className="text-[10px] text-slate-300 font-mono">APP VER: {APP_VERSION}</p>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
