import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Package, Settings, FileText, Home, LogOut, User as UserIcon, LogIn, ShieldAlert, Menu, X, LayoutDashboard } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// 버전 번호: YY.MM.DD.HH.mm (현재 시간 기준 생성)
const APP_VERSION = "v24.05.22.18.35";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 모바일 메뉴 오픈 시 바디 스크롤 잠금
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const isActive = (path: string) => {
    return location.pathname === path 
      ? "text-primary bg-primary-light font-bold" 
      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium";
  };

  const handleSignOut = async () => {
    await signOut();
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <nav className="sticky top-0 z-[100] w-full bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-end gap-1">
            <Link to="/" className="flex items-center gap-2 shrink-0 group" onClick={closeMobileMenu}>
              <div className="bg-primary p-2 rounded-xl text-white shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
                <Package size={20} strokeWidth={3} />
              </div>
              <span className="text-xl font-[1000] tracking-tighter text-slate-900 sm:text-2xl">송장.com</span>
            </Link>
            <span className="text-[9px] text-slate-400 font-mono mb-1 hidden sm:block">{APP_VERSION}</span>
          </div>

          {/* Desktop Navigation */}
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
                <Link to="/admin" className={`px-3 py-1.5 rounded-xl text-sm transition-all flex items-center gap-2 ${isActive('/admin')} border border-red-100 text-red-600`}>
                  <ShieldAlert size={16} /> 관리자
                </Link>
            )}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
             {user ? (
               <div className="flex items-center gap-2">
                 <button 
                   onClick={() => navigate('/products?tab=account')}
                   className="hidden sm:flex items-center gap-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-xl transition-all font-bold"
                 >
                   <UserIcon size={14} />
                   <span className="max-w-[120px] truncate">{user.email?.split('@')[0]}님</span>
                 </button>
                 
                 <button 
                  onClick={handleSignOut}
                  className="hidden md:flex p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                  title="로그아웃"
                 >
                   <LogOut size={22} />
                 </button>
                 
                 <button onClick={toggleMobileMenu} className="md:hidden p-2.5 text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors z-[110]">
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

      {/* Mobile Menu Overlay & Container */}
      {isMobileMenuOpen && (
        <>
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[98] animate-in fade-in duration-300"
            onClick={closeMobileMenu}
          />
          
          {/* Menu Drawer */}
          <div className="md:hidden fixed inset-y-0 right-0 w-[80%] max-w-sm z-[99] bg-white shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
            <div className="flex-1 overflow-y-auto p-6 pt-20 space-y-2">
              <Link to="/" onClick={closeMobileMenu} className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-lg ${isActive('/')}`}>
                <Home size={22} /> 홈 화면
              </Link>
              {user && (
                <>
                  <Link to="/products" onClick={closeMobileMenu} className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-lg ${isActive('/products')}`}>
                    <Settings size={22} /> 제품 관리
                  </Link>
                  <Link to="/convert" onClick={closeMobileMenu} className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-lg ${isActive('/convert')}`}>
                    <FileText size={22} /> 송장 변환
                  </Link>
                  {isAdmin && (
                    <Link to="/admin" onClick={closeMobileMenu} className={`flex items-center gap-4 px-5 py-4 rounded-2xl text-lg bg-red-50 text-red-600 border border-red-100 ${isActive('/admin')}`}>
                      <LayoutDashboard size={22} /> 관리자 모드
                    </Link>
                  )}
                </>
              )}
            </div>
            
            {user && (
              <div className="mt-auto p-6 border-t border-slate-100 bg-slate-50">
                <div className="flex items-center gap-3 mb-6 px-2">
                  <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                    <UserIcon size={20} />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-sm font-black text-slate-900 truncate">{user.email}</p>
                    <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">{APP_VERSION}</p>
                  </div>
                </div>
                <button 
                  onClick={handleSignOut} 
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-black transition-colors"
                >
                  <LogOut size={20} /> 로그아웃
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </nav>
  );
};