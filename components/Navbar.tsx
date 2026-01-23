
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Package, Settings, FileText, Home, LogOut, User as UserIcon, LogIn, ShieldAlert, Menu, X, LayoutDashboard, ChevronRight, TrendingUp } from 'lucide-react';
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
            <button onClick={closeMobileMenu} className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 rounded-full transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="space-y-4">
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">주요 메뉴</p>
              
              <Link to="/" onClick={closeMobileMenu} className={`flex items-center justify-between px-5 py-5 rounded-2xl border-2 transition-all ${isActive('/')}`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${location.pathname === '/' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}><Home size={22} /></div>
                  <span className="text-lg font-bold">홈 화면</span>
                </div>
                <ChevronRight size={20} className="opacity-30" />
              </Link>

              {user && (
                <>
                  <Link to="/products" onClick={closeMobileMenu} className={`flex items-center justify-between px-5 py-5 rounded-2xl border-2 transition-all ${isActive('/products')}`}>
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${location.pathname === '/products' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}><Settings size={22} /></div>
                      <span className="text-lg font-bold">제품 관리</span>
                    </div>
                    <ChevronRight size={20} className="opacity-30" />
                  </Link>

                  <Link to="/convert" onClick={closeMobileMenu} className={`flex items-center justify-between px-5 py-5 rounded-2xl border-2 transition-all ${isActive('/convert')}`}>
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${location.pathname === '/convert' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}><FileText size={22} /></div>
                      <span className="text-lg font-bold">송장 변환</span>
                    </div>
                    <ChevronRight size={20} className="opacity-30" />
                  </Link>

                  <Link to="/crm" onClick={closeMobileMenu} className={`flex items-center justify-between px-5 py-5 rounded-2xl border-2 transition-all ${isActive('/crm')}`}>
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${location.pathname === '/crm' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500'}`}><TrendingUp size={22} /></div>
                      <span className="text-lg font-bold">매출 CRM</span>
                    </div>
                    <ChevronRight size={20} className="opacity-30" />
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="p-8 border-t border-slate-100 bg-slate-50/50">
             <Button onClick={handleSignOut} className="w-full">로그아웃</Button>
          </div>
        </div>
      )}
    </nav>
  );
};
