
import React from 'react';
import { Link } from 'react-router-dom';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left">
            <h3 className="text-sm font-black text-slate-900">송장.com</h3>
            <p className="text-xs text-slate-500 mt-1">쇼핑몰 업무 자동화 솔루션</p>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/blog" className="text-xs text-slate-600 hover:text-primary transition-colors">블로그</Link>
            <Link to="/terms" className="text-xs text-slate-600 hover:text-primary transition-colors">이용약관</Link>
            <Link to="/privacy" className="text-xs text-slate-600 hover:text-primary transition-colors">개인정보처리방침</Link>
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-[10px] text-slate-400 flex flex-col sm:flex-row gap-1 sm:gap-3 text-center sm:text-left items-center flex-wrap justify-center md:justify-start">
                <span>상호: (주)미성상회</span>
                <span className="hidden sm:inline">|</span>
                <span>문의: misungcorp@gmail.com</span>
                <span className="hidden sm:inline">|</span>
                <span>사업자등록번호: 551-87-02467</span>
                <span className="hidden sm:inline">|</span>
                <span>통신판매업신고: 제2022-창원성산-0792호</span>
            </div>
            <p className="text-[10px] text-slate-400 whitespace-nowrap">© 2024 (주)미성상회. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};
