
import React, { useEffect, useState, useMemo } from 'react';
import { fetchAllProfiles, updateUserProfile, fetchAllActivityLogs, logActivity, fetchAppSettings, AppSettings } from '../services/dbService';
import { UserProfile, ActivityLog } from '../types';
import { Button } from '../components/Button';
import { ShieldAlert, Search, Calendar, Check, X, Edit, Zap, Users, ScrollText, Lock, UserCog, Clock, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Copy, Terminal, AlertOctagon, Settings, Link as LinkIcon, Youtube, ExternalLink, HelpCircle, UserPlus, Clock3, UserCheck, Shield } from 'lucide-react';
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

    const [activeTab, setActiveTab] = useState<'users' | 'logs'>('users');
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [logs, setLogs] = useState<ActivityLog[]>([]);
    const [settings, setSettings] = useState<AppSettings>({
        silver_subscription_url: '',
        gold_subscription_url: '',
        youtube_tutorial_template: '',
        youtube_tutorial_product: '',
        youtube_tutorial_convert: ''
    });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showSolution, setShowSolution] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });

    // DB의 tiers 테이블 수치를 최신 정책에 맞게 강제 업데이트하는 쿼리 추가
    const SQL_SOLUTION = `-- [SQL V18] 등급 정책 최적화 패치
-- 1. 등급별 제한 수치 동기화 (FREE 2/1 하향, 실버 8/3, 골드 100/50)
UPDATE public.tiers SET max_products = 2, max_templates = 1 WHERE id = 'free';
UPDATE public.tiers SET max_products = 8, max_templates = 3 WHERE id = 'silver';
UPDATE public.tiers SET max_products = 100, max_templates = 50 WHERE id = 'gold';

-- 2. 시스템 설정 테이블 및 보안 정책
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_read_policy" ON public.app_settings;
DROP POLICY IF EXISTS "settings_admin_full_policy" ON public.app_settings;
CREATE POLICY "settings_read_policy" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "settings_admin_full_policy" ON public.app_settings FOR ALL TO authenticated 
USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'super_admin') );

-- 3. 최고 관리자 권한 부여
UPDATE public.profiles SET role = 'super_admin' WHERE email = 'ungqum77@gmail.com';
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
            const settingsData = await fetchAppSettings();
            setSettings(settingsData);
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

    const extendSubscription = async (profile: UserProfile) => {
        const currentEnd = profile.subscription_end_date ? new Date(profile.subscription_end_date) : new Date();
        const newEnd = new Date(currentEnd);
        newEnd.setDate(newEnd.getDate() + 30);
        
        const logMsg = `관리자가 사용자(${profile.email})의 구독을 1개월 연장했습니다. (${newEnd.toLocaleDateString()} 까지)`;
        
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
                    <button onClick={() => setActiveTab('logs')} className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'logs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>활동 로그</button>
                </div>
            </div>

            {/* SQL 패치 가이드 */}
            <div className="mb-6 bg-slate-900 rounded-xl p-6 border border-slate-700 shadow-2xl animate-fade-in">
                <div className="flex justify-between items-center mb-4 text-green-400 font-bold text-sm font-mono">
                    <div className="flex items-center gap-2"><Terminal size={16} /> SQL Sync Script (DB 수치 동기화)</div>
                    <button onClick={() => { navigator.clipboard.writeText(SQL_SOLUTION); alert("복사되었습니다. Supabase SQL Editor에 붙여넣어 실행하세요."); }} className="text-xs bg-green-700 text-white px-3 py-1.5 rounded hover:bg-green-600 transition-colors flex items-center gap-1">
                        <Copy size={12} /> 코드 복사
                    </button>
                </div>
                <p className="text-[11px] text-slate-400 mb-2 italic">* DB의 tiers 테이블 값이 앱 설정과 다를 경우 아래 스크립트를 실행하여 강제 동기화하세요.</p>
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
                                                    onClick={() => extendSubscription(p)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-md hover:bg-indigo-100 font-bold border border-indigo-200 transition-colors"
                                                    title="구독 1개월(30일) 연장"
                                                >
                                                    <Clock3 size={14} /> +1개월
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
