
import React, { useEffect, useState, useMemo } from 'react';
import { fetchAllProfiles, updateUserProfile, fetchAllActivityLogs, logActivity, fetchAppSettings, AppSettings, updateAppSettings, fetchAllTiers, updateTier } from '../services/dbService';
import { UserProfile, ActivityLog, Tier } from '../types';
import { Button } from '../components/Button';
import { ShieldAlert, Search, Calendar, Check, X, Edit, Zap, Users, ScrollText, Lock, UserCog, Clock, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Copy, Terminal, AlertOctagon, Settings, Link as LinkIcon, Youtube, ExternalLink, HelpCircle, UserPlus, Clock3, UserCheck, Shield, DollarSign, Tag, Merge, Database, CalendarPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, IS_CONFIG_ERROR } from '../services/supabase';

type SortKey = 'email' | 'tier' | 'role' | 'subscription' | 'created_at';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
    key: SortKey;
    direction: SortDirection;
}

const YouTubeEmbed = ({ url, title }: { url: string; title: string }) => {
    if (!url) return null;
    let videoId = '';
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') videoId = urlObj.pathname.slice(1);
        else if (urlObj.hostname.includes('youtube.com')) videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop() || '';
    } catch (e) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        videoId = (match && match[2].length === 11) ? match[2] : '';
    }
    if (!videoId) return null;
    return (
        <div className="mt-8 mb-4 max-w-xl mx-auto bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-700">
             <div className="flex items-center justify-between p-3 bg-slate-800 text-white border-b border-slate-700">
                 <div className="flex items-center gap-2"><Youtube className="text-red-500" size={16}/><span className="font-bold text-xs">도움말: {title}</span></div>
                 <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold transition-colors"><ExternalLink size={10} /> YouTube에서 보기</a>
             </div>
             <div className="relative pb-[56.25%] h-0 bg-black"><iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${videoId}?rel=0`} title={title} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe></div>
        </div>
    );
};

export const AdminDashboard: React.FC = () => {
    const { user: currentUser, isAdmin, isSuperAdmin, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'settings'>('users');
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [tiers, setTiers] = useState<Tier[]>([]);
    const [settings, setSettings] = useState<AppSettings>({
        silver_subscription_url: '',
        gold_subscription_url: '',
        youtube_tutorial_template: '',
        youtube_tutorial_product: '',
        youtube_tutorial_convert: '',
        price_silver_original: '',
        price_silver_sale: '',
        price_gold_original: '',
        price_gold_sale: ''
    });
    // Temporary state for editing tier limits
    const [tierLimits, setTierLimits] = useState({ free: 20, silver: 300 });

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSolution, setShowSolution] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });

    const SQL_SOLUTION = `-- [SQL V22] 통합 DB 업데이트 스크립트 (CRM & Tiers)

-- 1. Sales Records 테이블 생성 (없을 경우)
CREATE TABLE IF NOT EXISTS public.sales_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    product_id UUID, 
    product_name TEXT,
    product_sku TEXT,
    supplier_name TEXT,
    order_id TEXT, -- 중복 방지용 주문번호
    quantity INTEGER DEFAULT 1,
    unit_sales_price NUMERIC DEFAULT 0,
    unit_purchase_cost NUMERIC DEFAULT 0,
    total_sales_amount NUMERIC DEFAULT 0,
    total_purchase_amount NUMERIC DEFAULT 0,
    total_shipping_cost NUMERIC DEFAULT 0,
    total_market_fee NUMERIC DEFAULT 0,
    net_profit NUMERIC DEFAULT 0,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sales_records_user_id ON public.sales_records(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_records_order_date ON public.sales_records(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_records_order_id ON public.sales_records(order_id);

-- 2. Tiers 테이블에 max_crm_count 컬럼 추가
ALTER TABLE public.tiers ADD COLUMN IF NOT EXISTS max_crm_count INTEGER DEFAULT 20;

-- 3. 등급별 저장 한도 설정
UPDATE public.tiers SET max_products = 2, max_templates = 1, max_crm_count = 20 WHERE id = 'free';
UPDATE public.tiers SET max_products = 8, max_templates = 3, max_crm_count = 300 WHERE id = 'silver';
UPDATE public.tiers SET max_products = 100, max_templates = 50, max_crm_count = 999999 WHERE id = 'gold';

-- 4. RLS 정책 (보안)
ALTER TABLE public.sales_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own sales records" ON public.sales_records;
CREATE POLICY "Users can view own sales records" ON public.sales_records FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own sales records" ON public.sales_records;
CREATE POLICY "Users can insert own sales records" ON public.sales_records FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own sales records" ON public.sales_records;
CREATE POLICY "Users can delete own sales records" ON public.sales_records FOR DELETE USING (auth.uid() = user_id);
`;

    useEffect(() => {
        if (authLoading) return;
        if (!currentUser || !isAdmin) { navigate('/'); return; }
        if (!IS_CONFIG_ERROR) loadData();
    }, [currentUser, isAdmin, authLoading, activeTab]);

    const loadData = async () => {
        if (IS_CONFIG_ERROR) return;
        setErrorMsg(null);
        setLoading(true);
        try {
            if (activeTab === 'users') {
                const data = await fetchAllProfiles();
                setProfiles(data);
            } else if (activeTab === 'logs') {
                const data = await fetchAllActivityLogs();
                setLogs(data);
            }
            // Always fetch settings & tiers
            const [settingsData, tiersData] = await Promise.all([
                fetchAppSettings(),
                fetchAllTiers()
            ]);
            setSettings(settingsData);
            setTiers(tiersData);
            
            // Set initial tier limits from DB
            const freeTier = tiersData.find(t => t.id === 'free');
            const silverTier = tiersData.find(t => t.id === 'silver');
            setTierLimits({
                free: freeTier?.max_crm_count || 20,
                silver: silverTier?.max_crm_count || 300
            });
            
        } catch (e: any) {
            console.error("Load Error:", e);
            setErrorMsg(e.message || "데이터 로드 중 오류가 발생했습니다.");
            setShowSolution(true);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateUser = async (userId: string, updates: any, logMsg?: string) => {
        try {
            setLoading(true);
            await updateUserProfile(userId, updates);
            if (currentUser && logMsg) {
                await logActivity(currentUser.id, 'ADMIN_ACTION', logMsg);
            }
            alert("사용자 정보가 업데이트되었습니다.");
            loadData();
        } catch (e: any) {
            alert("수정 실패: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            // 1. Update App Settings
            await updateAppSettings(settings);
            
            // 2. Update Tiers Limits
            await updateTier('free', { max_crm_count: tierLimits.free });
            await updateTier('silver', { max_crm_count: tierLimits.silver });
            
            if (currentUser) await logActivity(currentUser.id, 'UPDATE_SETTINGS', '관리자 설정(가격/URL/한도) 업데이트');
            alert('설정이 저장되었습니다.');
        } catch (e: any) {
            alert('저장 실패: ' + e.message);
        } finally {
            setLoading(false);
        }
    };

    const extendSubscription = async (profile: UserProfile, days: number) => {
        const now = new Date();
        let baseDate = now;
        
        // 현재 구독 종료일이 미래라면 해당 날짜를 기준으로 연장, 이미 지났거나 없다면 오늘부터 시작
        if (profile.subscription_end_date) {
            const currentEnd = new Date(profile.subscription_end_date);
            if (currentEnd > now) {
                baseDate = currentEnd;
            }
        }
        
        const newEnd = new Date(baseDate);
        newEnd.setDate(newEnd.getDate() + days);
        
        const logMsg = `관리자가 사용자(${profile.email})의 구독을 ${days}일 연장했습니다. (${newEnd.toLocaleDateString()} 까지)`;
        
        await handleUpdateUser(profile.id, {
            subscription_end_date: newEnd.toISOString(),
            subscription_start_date: profile.subscription_start_date || new Date().toISOString()
        }, logMsg);
    };

    const sortedAndFilteredProfiles = useMemo(() => {
        let result = [...profiles];
        if (searchTerm) {
            const lowerTerm = searchTerm.toLowerCase().trim();
            result = result.filter(p => (p.email || '').toLowerCase().includes(lowerTerm) || p.id.toLowerCase().includes(lowerTerm));
        }
        result.sort((a, b) => {
            let aKey = sortConfig.key === 'subscription' ? 'subscription_end_date' : sortConfig.key;
            let aValue: any = (a as any)[aKey] || '';
            let bValue: any = (b as any)[aKey] || '';
            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });
        return result;
    }, [profiles, searchTerm, sortConfig]);

    if (authLoading) return <div className="p-10 text-center">인증 확인 중...</div>;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100 text-red-600 shadow-sm shadow-red-100"><ShieldAlert size={24} /></div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">관리자 대시보드</h1>
                        <p className="text-sm text-slate-500">사용자 권한 및 시스템 로그 관리</p>
                    </div>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button onClick={() => setActiveTab('users')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>사용자 관리</button>
                    <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>시스템 설정</button>
                    <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>활동 로그</button>
                </div>
            </div>

            {/* Quick Actions / Hidden Features */}
            <div className="mb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <button 
                    onClick={() => navigate('/admin/match')}
                    className="flex items-center gap-4 p-5 bg-gradient-to-br from-indigo-500 to-primary rounded-xl text-white shadow-lg hover:shadow-xl transition-all hover:-translate-y-0.5"
                >
                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                        <Merge size={24} />
                    </div>
                    <div className="text-left">
                        <h3 className="font-bold text-lg">배송 정보 매칭</h3>
                        <p className="text-xs text-indigo-100">원본 주문서에 운송장 번호 병합</p>
                    </div>
                </button>
            </div>

            {/* SQL 패치 가이드 */}
            <div className="mb-6 bg-slate-900 rounded-xl p-6 border border-slate-700 shadow-2xl animate-fade-in">
                <div className="flex justify-between items-center mb-4 text-green-400 font-bold text-sm font-mono">
                    <div className="flex items-center gap-2"><Terminal size={16} /> SQL Sync Script (DB 업데이트)</div>
                    <button onClick={() => { navigator.clipboard.writeText(SQL_SOLUTION); alert("복사되었습니다. Supabase SQL Editor에 붙여넣어 실행하세요."); }} className="text-xs bg-green-700 text-white px-3 py-1.5 rounded hover:bg-green-600 transition-colors flex items-center gap-1">
                        <Copy size={12} /> 코드 복사
                    </button>
                </div>
                <p className="text-[11px] text-slate-400 mb-2 italic">* 'max_crm_count' 컬럼 추가 및 'sales_records' 테이블 생성을 위한 SQL입니다.</p>
                <pre className="text-[11px] font-mono text-slate-300 bg-black/40 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed border border-slate-800">{SQL_SOLUTION}</pre>
            </div>

            {errorMsg && (
                <div className="mb-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3">
                    <AlertTriangle className="shrink-0 mt-0.5 text-red-500" size={18} />
                    <p className="text-sm font-medium">{errorMsg}</p>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
                {loading ? (
                    <div className="p-20 text-center flex flex-col items-center justify-center h-full">
                        <RefreshCw className="animate-spin h-10 w-10 text-primary mb-4" />
                        <p className="text-slate-500 font-medium">로딩 중...</p>
                    </div>
                ) : activeTab === 'logs' ? (
                    <div className="p-4 overflow-x-auto">
                         <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 border-b text-slate-500 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">시간</th>
                                    <th className="px-6 py-4">사용자</th>
                                    <th className="px-6 py-4">동작</th>
                                    <th className="px-6 py-4">내용</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {logs.length === 0 ? (
                                    <tr><td colSpan={4} className="p-10 text-center text-slate-400">기록이 없습니다.</td></tr>
                                ) : (
                                    logs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-slate-400 text-xs font-mono">{new Date(log.created_at).toLocaleString()}</td>
                                            <td className="px-6 py-4 font-medium text-slate-700">{log.user_email}</td>
                                            <td className="px-6 py-4">
                                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200 uppercase">{log.action_type}</span>
                                            </td>
                                            <td className="px-6 py-4 text-slate-600">{log.description}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : activeTab === 'settings' ? (
                    <div className="p-8">
                        {/* Settings content same as before */}
                        <div className="mb-6 pb-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2"><Settings size={20} className="text-primary"/> 시스템 설정 관리</h3>
                            <p className="text-sm text-slate-500">가격, 할인율, 구독 링크 등 주요 설정을 실시간으로 반영합니다.</p>
                        </div>
                        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                            <div className="space-y-6">
                                <h4 className="font-bold text-slate-700 flex items-center gap-2"><DollarSign size={16}/> 가격 설정 (Pricing)</h4>
                                <div className="p-5 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">실버 - 정상가 (원)</label>
                                            <input type="number" className="w-full border rounded p-2 text-sm" value={settings.price_silver_original} onChange={e => setSettings({...settings, price_silver_original: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-blue-600 mb-1">실버 - 판매가 (할인)</label>
                                            <input type="number" className="w-full border border-blue-200 rounded p-2 text-sm focus:ring-blue-500" value={settings.price_silver_sale} onChange={e => setSettings({...settings, price_silver_sale: e.target.value})} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-200">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">골드 - 정상가 (원)</label>
                                            <input type="number" className="w-full border rounded p-2 text-sm" value={settings.price_gold_original} onChange={e => setSettings({...settings, price_gold_original: e.target.value})} />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-amber-600 mb-1">골드 - 판매가 (할인)</label>
                                            <input type="number" className="w-full border border-amber-200 rounded p-2 text-sm focus:ring-amber-500" value={settings.price_gold_sale} onChange={e => setSettings({...settings, price_gold_sale: e.target.value})} />
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400">* 판매가가 정상가보다 낮을 경우, 메인 화면에 자동으로 '할인 배지'가 표시됩니다.</p>
                                </div>

                                <h4 className="font-bold text-slate-700 flex items-center gap-2 pt-2"><Database size={16}/> CRM 데이터 저장 한도 (Tiers)</h4>
                                <div className="space-y-3 p-5 bg-slate-50 rounded-xl border border-slate-200">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">무료(Free) 등급 한도 (개)</label>
                                        <input type="number" className="w-full border rounded p-2 text-sm" placeholder="기본값: 20" value={tierLimits.free} onChange={e => setTierLimits({...tierLimits, free: Number(e.target.value)})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">실버(Silver) 등급 한도 (개)</label>
                                        <input type="number" className="w-full border rounded p-2 text-sm" placeholder="기본값: 300" value={tierLimits.silver} onChange={e => setTierLimits({...tierLimits, silver: Number(e.target.value)})} />
                                    </div>
                                    <p className="text-[10px] text-slate-400">* 골드 등급은 무제한입니다. (이 값은 TIERS 테이블의 max_crm_count에 저장됩니다)</p>
                                </div>

                                <h4 className="font-bold text-slate-700 flex items-center gap-2 pt-2"><LinkIcon size={16}/> 결제 및 구독 URL</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">실버 등급 결제 링크</label>
                                        <input type="text" className="w-full border rounded p-2 text-sm" placeholder="https://..." value={settings.silver_subscription_url} onChange={e => setSettings({...settings, silver_subscription_url: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">골드 등급 결제 링크</label>
                                        <input type="text" className="w-full border rounded p-2 text-sm" placeholder="https://..." value={settings.gold_subscription_url} onChange={e => setSettings({...settings, gold_subscription_url: e.target.value})} />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h4 className="font-bold text-slate-700 flex items-center gap-2"><Youtube size={16}/> 튜토리얼 영상 링크</h4>
                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">송장 양식 등록 가이드</label>
                                        <input type="text" className="w-full border rounded p-2 text-sm" value={settings.youtube_tutorial_template} onChange={e => setSettings({...settings, youtube_tutorial_template: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">제품 등록 가이드</label>
                                        <input type="text" className="w-full border rounded p-2 text-sm" value={settings.youtube_tutorial_product} onChange={e => setSettings({...settings, youtube_tutorial_product: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">송장 변환 가이드</label>
                                        <input type="text" className="w-full border rounded p-2 text-sm" value={settings.youtube_tutorial_convert} onChange={e => setSettings({...settings, youtube_tutorial_convert: e.target.value})} />
                                    </div>
                                </div>

                                <div className="bg-yellow-50 border border-yellow-100 p-4 rounded-xl">
                                    <h5 className="font-bold text-yellow-800 text-sm mb-2 flex items-center gap-1"><AlertTriangle size={14}/> 주의사항</h5>
                                    <ul className="text-xs text-yellow-700 space-y-1 list-disc pl-4">
                                        <li>가격 정보는 숫자만 입력하세요 (콤마 제외).</li>
                                        <li>저장 버튼을 누르면 즉시 모든 사용자에게 반영됩니다.</li>
                                    </ul>
                                </div>
                                
                                <div className="pt-4 flex justify-end">
                                    <Button type="submit" size="lg" icon={<Check size={18}/>}>설정 저장하기</Button>
                                </div>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div className="p-4 overflow-x-auto">
                        <div className="mb-4 flex gap-2">
                             <div className="relative flex-1 max-w-md">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="text" 
                                    placeholder="사용자 검색..." 
                                    className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                             </div>
                             <Button variant="secondary" onClick={loadData} icon={<RefreshCw size={16} />} />
                        </div>
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-slate-50 border-b text-slate-500 font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-4">사용자(이메일)</th>
                                    <th className="px-4 py-4">현재 등급</th>
                                    <th className="px-4 py-4">권한 변경</th>
                                    <th className="px-4 py-4">만료 예정일</th>
                                    <th className="px-4 py-4 text-center">작업</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {sortedAndFilteredProfiles.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-4">
                                            <div className="font-bold text-slate-900">{p.email}</div>
                                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.id}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <select 
                                                className={`px-2 py-1 rounded border text-[11px] font-bold outline-none ${
                                                    p.tier_id === 'gold' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' :
                                                    p.tier_id === 'silver' ? 'bg-slate-50 text-slate-700 border-slate-200' :
                                                    'bg-blue-50 text-blue-700 border-blue-200'
                                                }`}
                                                value={p.tier_id}
                                                onChange={(e) => handleUpdateUser(p.id, { tier_id: e.target.value }, `사용자(${p.email})의 등급을 ${e.target.value}로 변경함`)}
                                            >
                                                <option value="free">무료 회원</option>
                                                <option value="silver">실버 회원</option>
                                                <option value="gold">골드 회원</option>
                                            </select>
                                        </td>
                                        <td className="px-4 py-4">
                                            <select 
                                                className={`px-2 py-1 rounded border text-[11px] font-medium outline-none ${
                                                    p.role === 'super_admin' ? 'bg-red-50 text-red-600 border-red-200' : 
                                                    p.role === 'admin' ? 'bg-purple-50 text-purple-600 border-purple-200' : 
                                                    'bg-slate-50 text-slate-500 border-slate-200'
                                                }`}
                                                value={p.role || 'user'}
                                                onChange={(e) => handleUpdateUser(p.id, { role: e.target.value }, `사용자(${p.email})의 권한을 ${e.target.value}로 변경함`)}
                                            >
                                                <option value="user">USER (일반)</option>
                                                <option value="admin">ADMIN (관리자)</option>
                                                {isSuperAdmin && <option value="super_admin">SUPER (최고)</option>}
                                            </select>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-slate-300" />
                                                <span className={p.subscription_end_date && new Date(p.subscription_end_date) < new Date() ? 'text-red-500 font-bold' : 'text-slate-600'}>
                                                    {p.subscription_end_date ? new Date(p.subscription_end_date).toLocaleDateString() : '미구독'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex justify-center gap-2">
                                                <button 
                                                    onClick={() => extendSubscription(p, 1)}
                                                    className="flex items-center gap-1.5 px-2 py-1.5 bg-slate-50 text-slate-600 rounded-md hover:bg-slate-100 font-bold border border-slate-200 transition-colors text-xs"
                                                    title="구독 1일 연장"
                                                >
                                                    <CalendarPlus size={14} /> +1일
                                                </button>
                                                <button 
                                                    onClick={() => extendSubscription(p, 30)}
                                                    className="flex items-center gap-1.5 px-2 py-1.5 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 font-bold border border-indigo-200 transition-colors text-xs"
                                                    title="구독 30일 연장"
                                                >
                                                    <Clock3 size={14} /> +30일
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            
            <YouTubeEmbed url={settings.youtube_tutorial_convert} title="시스템 관리 가이드" />
        </div>
    );
};
