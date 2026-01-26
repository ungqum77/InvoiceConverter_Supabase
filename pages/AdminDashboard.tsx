
import React, { useEffect, useState, useMemo } from 'react';
import { fetchAllProfiles, updateUserProfile, fetchAllActivityLogs, logActivity, fetchAppSettings, AppSettings, updateAppSettings, fetchAllTiers, updateTier, fetchAnalyticsStats, trackEvent } from '../services/dbService';
import { UserProfile, ActivityLog, Tier, AnalyticsEvent } from '../types';
import { Button } from '../components/Button';
import { ShieldAlert, Search, Calendar, Check, X, Edit, Zap, Users, ScrollText, Lock, UserCog, Clock, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Copy, Terminal, AlertOctagon, Settings, Link as LinkIcon, Youtube, ExternalLink, HelpCircle, UserPlus, Clock3, UserCheck, Shield, DollarSign, Tag, Merge, Database, CalendarPlus, BarChart2, PieChart, Activity, MousePointer2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, IS_CONFIG_ERROR } from '../services/supabase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';

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

    const [activeTab, setActiveTab] = useState<'users' | 'logs' | 'settings' | 'analytics'>('users');
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [analyticsData, setAnalyticsData] = useState<AnalyticsEvent[]>([]);
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
    
    // Analytics Filters
    const [analyticsStart, setAnalyticsStart] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)); // 1 week ago
    const [analyticsEnd, setAnalyticsEnd] = useState(new Date().toISOString().slice(0, 10));

    const SQL_SOLUTION = `-- [SQL V23] 비즈니스 분석(CRM)용 이벤트 테이블 생성
CREATE TABLE IF NOT EXISTS public.analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL, -- 'visit', 'signup', 'login', 'click_subscription', 'payment_success', 'delete_account'
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- 비회원일 경우 NULL
    metadata JSONB DEFAULT '{}'::jsonb, -- { is_new_visitor: true, tier: 'silver' ... }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 성능을 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_analytics_created_at ON public.analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON public.analytics_events(event_type);

-- RLS (관리자만 조회, 누구나 삽입 가능)
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can insert events" ON public.analytics_events;
CREATE POLICY "Anyone can insert events" ON public.analytics_events FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can view events" ON public.analytics_events;
CREATE POLICY "Admins can view events" ON public.analytics_events FOR SELECT USING (
  exists (select 1 from public.profiles where id = auth.uid() and (role = 'admin' or role = 'super_admin'))
);
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
            } else if (activeTab === 'analytics') {
                const data = await fetchAnalyticsStats(analyticsStart, analyticsEnd);
                setAnalyticsData(data);
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
    
    // When dates change in Analytics tab, reload only analytics data
    useEffect(() => {
        if (activeTab === 'analytics' && !loading) {
            const loadAnalytics = async () => {
                const data = await fetchAnalyticsStats(analyticsStart, analyticsEnd);
                setAnalyticsData(data);
            };
            loadAnalytics();
        }
    }, [analyticsStart, analyticsEnd]);

    const handleUpdateUser = async (userId: string, updates: any, logMsg?: string) => {
        try {
            setLoading(true);
            await updateUserProfile(userId, updates);
            if (currentUser && logMsg) {
                await logActivity(currentUser.id, 'ADMIN_ACTION', logMsg);
            }
            // 등급이 상향 조정되면 결제(성공) 이벤트로 간주하여 기록
            if (updates.tier_id && updates.tier_id !== 'free') {
                trackEvent('payment_success', { tier: updates.tier_id, manual_by_admin: true });
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

    // Analytics Metrics Calculation
    const analyticsMetrics = useMemo(() => {
        const signups = analyticsData.filter(e => e.event_type === 'signup').length;
        const logins = analyticsData.filter(e => e.event_type === 'login').length;
        const visits = analyticsData.filter(e => e.event_type === 'visit').length;
        const newVisits = analyticsData.filter(e => e.event_type === 'visit' && e.metadata?.is_new_visitor).length;
        const subClicks = analyticsData.filter(e => e.event_type === 'click_subscription').length;
        const payments = analyticsData.filter(e => e.event_type === 'payment_success').length;
        const deletions = analyticsData.filter(e => e.event_type === 'delete_account').length;
        
        // Conversion Rates
        const conversionRate = visits > 0 ? ((signups / visits) * 100).toFixed(1) : '0';
        const clickRate = visits > 0 ? ((subClicks / visits) * 100).toFixed(1) : '0';

        // Chart Data (Group by Date)
        const dateMap: Record<string, any> = {};
        analyticsData.forEach(e => {
            const date = new Date(e.created_at).toLocaleDateString();
            if (!dateMap[date]) dateMap[date] = { date, visits: 0, signups: 0, clicks: 0 };
            if (e.event_type === 'visit') dateMap[date].visits++;
            if (e.event_type === 'signup') dateMap[date].signups++;
            if (e.event_type === 'click_subscription') dateMap[date].clicks++;
        });
        const chartData = Object.values(dateMap).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return { signups, logins, visits, newVisits, subClicks, payments, deletions, conversionRate, clickRate, chartData };
    }, [analyticsData]);

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
                <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto">
                    <button onClick={() => setActiveTab('users')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>사용자 관리</button>
                    {isSuperAdmin && (
                        <button onClick={() => setActiveTab('analytics')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'analytics' ? 'bg-white text-indigo-700 shadow-sm font-bold' : 'text-slate-500 hover:text-slate-700'}`}>CRM (비즈니스 분석)</button>
                    )}
                    <button onClick={() => setActiveTab('settings')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'settings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>시스템 설정</button>
                    <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>활동 로그</button>
                </div>
            </div>

            {/* Quick Actions / Hidden Features */}
            {activeTab !== 'analytics' && (
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
            )}

            {/* SQL 패치 가이드 (분석 탭 활성화 시 보이도록) */}
            {(showSolution || activeTab === 'analytics') && (
                <div className="mb-6 bg-slate-900 rounded-xl p-6 border border-slate-700 shadow-2xl animate-fade-in">
                    <div className="flex justify-between items-center mb-4 text-green-400 font-bold text-sm font-mono">
                        <div className="flex items-center gap-2"><Terminal size={16} /> SQL Sync Script (이벤트 테이블 생성)</div>
                        <button onClick={() => { navigator.clipboard.writeText(SQL_SOLUTION); alert("복사되었습니다. Supabase SQL Editor에 붙여넣어 실행하세요."); }} className="text-xs bg-green-700 text-white px-3 py-1.5 rounded hover:bg-green-600 transition-colors flex items-center gap-1">
                            <Copy size={12} /> 코드 복사
                        </button>
                    </div>
                    <p className="text-[11px] text-slate-400 mb-2 italic">* 분석 기능을 사용하려면 `analytics_events` 테이블이 필요합니다.</p>
                    <pre className="text-[11px] font-mono text-slate-300 bg-black/40 p-4 rounded-lg overflow-x-auto whitespace-pre-wrap leading-relaxed border border-slate-800">{SQL_SOLUTION}</pre>
                </div>
            )}

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
                ) : activeTab === 'analytics' ? (
                    <div className="p-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Activity className="text-primary"/> 비즈니스 인사이트</h3>
                                <p className="text-sm text-slate-500">방문자 행동 및 전환율 분석</p>
                            </div>
                            <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200">
                                <Calendar size={16} className="text-slate-400 ml-2"/>
                                <input type="date" value={analyticsStart} onChange={e => setAnalyticsStart(e.target.value)} className="bg-transparent text-sm border-none focus:ring-0 text-slate-700"/>
                                <span className="text-slate-300">~</span>
                                <input type="date" value={analyticsEnd} onChange={e => setAnalyticsEnd(e.target.value)} className="bg-transparent text-sm border-none focus:ring-0 text-slate-700"/>
                                <button onClick={() => loadData()} className="p-1.5 bg-white border rounded hover:bg-slate-50"><RefreshCw size={14}/></button>
                            </div>
                        </div>

                        {/* Score Cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
                                <div className="text-xs font-bold text-blue-600 mb-2 flex items-center gap-1"><Users size={14}/> 방문자 (신규/전체)</div>
                                <div className="text-2xl font-black text-slate-800">{analyticsMetrics.visits.toLocaleString()}</div>
                                <div className="text-xs text-slate-500 mt-1">신규 {analyticsMetrics.newVisits.toLocaleString()}명</div>
                            </div>
                            <div className="bg-green-50/50 p-5 rounded-xl border border-green-100">
                                <div className="text-xs font-bold text-green-600 mb-2 flex items-center gap-1"><UserPlus size={14}/> 신규 가입</div>
                                <div className="text-2xl font-black text-slate-800">{analyticsMetrics.signups.toLocaleString()}</div>
                                <div className="text-xs text-slate-500 mt-1">전환율 {analyticsMetrics.conversionRate}%</div>
                            </div>
                            <div className="bg-amber-50/50 p-5 rounded-xl border border-amber-100">
                                <div className="text-xs font-bold text-amber-600 mb-2 flex items-center gap-1"><MousePointer2 size={14}/> 구독 의도 (클릭)</div>
                                <div className="text-2xl font-black text-slate-800">{analyticsMetrics.subClicks.toLocaleString()}</div>
                                <div className="text-xs text-slate-500 mt-1">클릭률 {analyticsMetrics.clickRate}%</div>
                            </div>
                            <div className="bg-purple-50/50 p-5 rounded-xl border border-purple-100">
                                <div className="text-xs font-bold text-purple-600 mb-2 flex items-center gap-1"><DollarSign size={14}/> 결제 완료 (등급상향)</div>
                                <div className="text-2xl font-black text-slate-800">{analyticsMetrics.payments.toLocaleString()}</div>
                                <div className="text-xs text-slate-500 mt-1">관리자 승인 포함</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <span className="text-xs text-slate-500 font-bold block mb-1">로그인 수</span>
                                <span className="text-lg font-bold">{analyticsMetrics.logins.toLocaleString()}</span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                                <span className="text-xs text-slate-500 font-bold block mb-1">회원 탈퇴</span>
                                <span className="text-lg font-bold text-red-500">{analyticsMetrics.deletions.toLocaleString()}</span>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 col-span-2 flex items-center gap-4">
                                <span className="text-xs text-slate-500 font-bold">인사이트:</span>
                                <span className="text-xs text-slate-700">
                                    방문자 대비 가입 전환율이 <strong>{analyticsMetrics.conversionRate}%</strong>입니다. 
                                    {Number(analyticsMetrics.conversionRate) < 5 ? ' 전환율 개선을 위해 랜딩 페이지 문구를 수정해보세요.' : ' 매우 훌륭한 수치입니다!'}
                                </span>
                            </div>
                        </div>

                        {/* Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[300px]">
                            <div className="bg-white p-4 rounded-xl border border-slate-200">
                                <h4 className="text-sm font-bold text-slate-700 mb-4">일별 트래픽 추이</h4>
                                <ResponsiveContainer width="100%" height="90%">
                                    <AreaChart data={analyticsMetrics.chartData}>
                                        <defs>
                                            <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                        <XAxis dataKey="date" tick={{fontSize: 10}} />
                                        <YAxis tick={{fontSize: 10}} />
                                        <Tooltip contentStyle={{fontSize: '12px'}} />
                                        <Area type="monotone" dataKey="visits" name="방문자" stroke="#3b82f6" fillOpacity={1} fill="url(#colorVisits)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="bg-white p-4 rounded-xl border border-slate-200">
                                <h4 className="text-sm font-bold text-slate-700 mb-4">주요 이벤트 발생 추이</h4>
                                <ResponsiveContainer width="100%" height="90%">
                                    <BarChart data={analyticsMetrics.chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                        <XAxis dataKey="date" tick={{fontSize: 10}} />
                                        <YAxis tick={{fontSize: 10}} />
                                        <Tooltip contentStyle={{fontSize: '12px'}} cursor={{fill: '#f8fafc'}}/>
                                        <Legend wrapperStyle={{fontSize: '10px'}}/>
                                        <Bar dataKey="signups" name="가입" fill="#22c55e" radius={[4,4,0,0]} />
                                        <Bar dataKey="clicks" name="구독클릭" fill="#f59e0b" radius={[4,4,0,0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

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
