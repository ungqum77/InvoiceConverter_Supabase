import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Package, Settings, FileText, Home, LogOut, User as UserIcon, LogIn, ShieldAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, signOut } = useAuth();

  const isActive = (path: string) => {
    return location.pathname === path ? "text-primary bg-primary-light font-semibold" : "text-slate-500 hover:text-slate-900 hover:bg-slate-100";
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const handleProfileClick = () => {
    navigate('/products?tab=account');
  };

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="bg-primary p-1.5 rounded-lg text-white">
              <Package size={20} strokeWidth={3} />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">InvoiceConverter</span>
          </Link>

          <div className="hidden md:flex items-center gap-2">
            <Link to="/" className={`px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${isActive('/')}`}>
              <Home size={18} /> 홈
            </Link>
            {user && (
              <>
                <Link to="/products" className={`px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${isActive('/products')}`}>
                  <Settings size={18} /> 제품 관리
                </Link>
                <Link to="/convert" className={`px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${isActive('/convert')}`}>
                  <FileText size={18} /> 송장 변환
                </Link>
              </>
            )}
            {isAdmin && (
                <Link to="/admin" className={`px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2 ${isActive('/admin')}`}>
                  <ShieldAlert size={18} /> 관리자
                </Link>
            )}
          </div>

          <div className="flex items-center gap-4">
             {user ? (
               <div className="flex items-center gap-3">
                 <button 
                   onClick={handleProfileClick}
                   className="flex items-center gap-2 text-sm text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors cursor-pointer"
                   title="내 정보 보기"
                 >
                   {isAdmin && <ShieldAlert size={14} className="text-red-500" />}
                   <UserIcon size={14} />
                   <span className="max-w-[100px] truncate">{user.email}</span>
                 </button>
                 <button 
                  onClick={handleSignOut}
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="로그아웃"
                 >
                   <LogOut size={20} />
                 </button>
               </div>
             ) : (
               <Link to="/auth" className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary-hover transition-colors">
                 <LogIn size={16} /> 로그인
               </Link>
             )}
          </div>
        </div>
      </div>
    </nav>
  );
};