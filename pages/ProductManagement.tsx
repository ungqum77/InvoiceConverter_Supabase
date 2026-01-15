
import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Search, Save, X, FileSpreadsheet, Upload, Settings2, Building2, Tag, CheckSquare, Pencil, Lock, Zap, UserCog, LogOut, AlertOctagon, Calendar, History, Clock, Download, ArrowUpCircle, CreditCard, Award, Youtube, AlertTriangle, RefreshCw, ExternalLink, Sparkles, ChevronRight, FileUp, Check, ArrowDownCircle } from 'lucide-react';
import { Product, InvoiceTemplate, UserProfile, ActivityLog, Tier } from '../types';
import { fetchProducts, createProduct, updateProduct, deleteProduct, fetchTemplates, createTemplate, deleteTemplate, getUserProfile, getUsageStats, createProductsBulk, fetchActivityLogs, fetchAppSettings, AppSettings } from '../services/dbService';
import { supabase } from '../services/supabase';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';

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

export const ProductManagement: React.FC = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [activeTab, setActiveTab] = useState<'templates' | 'products' | 'account'>('templates');
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState({ productCount: 0, templateCount: 0 });
  const [appSettings, setAppSettings] = useState<AppSettings>({
    silver_subscription_url: '',
    gold_subscription_url: '',
    youtube_tutorial_template: '',
    youtube_tutorial_product: '',
    youtube_tutorial_convert: ''
  });
  const [loading, setLoading] = useState(true);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [newAdditionalName, setNewAdditionalName] = useState('');
  const [newUseAdditionalName, setNewUseAdditionalName] = useState(false);
  
  const templateFileRef = useRef<HTMLInputElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'account' || tabParam === 'products' || tabParam === 'templates') setActiveTab(tabParam);
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (user) {
          const [prodData, tplData, userData, usageData, logData, settingsData] = await Promise.all([
            fetchProducts(),
            fetchTemplates(),
            getUserProfile(user.id),
            getUsageStats(user.id),
            fetchActivityLogs(user.id),
            fetchAppSettings()
          ]);
          setProducts(prodData);
          setTemplates(tplData);
          if (userData) setProfile(userData);
          if (usageData) setStats(usageData);
          setLogs(logData);
          setAppSettings(settingsData);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSoftDeleteAccount = async () => {
      if (!window.confirm("정말로 탈퇴하시겠습니까?")) return;
      const confirmEmail = prompt("이메일 주소를 다시 입력해주세요.");
      if (confirmEmail !== user?.email) { alert("일치하지 않습니다."); return; }
      try {
          if (supabase) await supabase.auth.updateUser({ data: { status: 'deleted', deleted_at: new Date().toISOString() } });
          alert("탈퇴 처리되었습니다.");
          await signOut();
          navigate('/');
      } catch (e: any) { alert("탈퇴 처리 중 오류: " + e.message); }
  };

  const handleOpenProductModal = (productToEdit?: Product) => {
    if (productToEdit) {
      setEditingProductId(productToEdit.id);
      setNewSku(productToEdit.sku);
      setNewName(productToEdit.name);
      setNewSupplier(productToEdit.supplierName);
      setSelectedTemplateId(productToEdit.templateId);
      setNewAdditionalName(productToEdit.additionalName || '');
      setNewUseAdditionalName(productToEdit.useAdditionalName || false);
    } else {
      setEditingProductId(null);
      setNewSku('');
      setNewName('');
      setNewSupplier('');
      setSelectedTemplateId('');
      setNewAdditionalName('');
      setNewUseAdditionalName(false);
    }
    setIsProductModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku || !newName || !newSupplier || !selectedTemplateId) return;
    try {
      const payload = { 
        sku: newSku, 
        name: newName, 
        supplierName: newSupplier, 
        templateId: selectedTemplateId,
        additionalName: newAdditionalName,
        useAdditionalName: newUseAdditionalName
      };
      if (editingProductId) await updateProduct(editingProductId, payload);
      else await createProduct(payload);
      setIsProductModalOpen(false);
      loadData();
    } catch (error: any) { alert(error.message); }
  };

  const handleProductDelete = async (id: string) => { if (window.confirm('삭제하시겠습니까?')) { await deleteProduct(id); loadData(); } };
  
  const handleTemplateDelete = async (id: string) => {
    if (window.confirm('양식을 삭제하시겠습니까? 관련 제품의 송장 출력이 불가능해질 수 있습니다.')) {
      try {
        await deleteTemplate(id);
        loadData();
      } catch (error: any) {
        alert("삭제 중 오류가 발생했습니다: " + error.message);
      }
    }
  };

  const handleTemplateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const result = evt.target?.result;
      if (typeof result !== 'string') return;
      const workbook = XLSX.read(result, { type: 'binary' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) return;
      const sheet = workbook.Sheets[String(firstSheetName)];
      const data = XLSX.utils.sheet_to_json(sheet as any, { header: 1 }) as any[][];
      
      if (data.length > 0) { 
          // 1행: 매핑용 헤더
          const inputHeaders = data[0].map(h => String(h));
          // 2행: 출력용 헤더 (존재하지 않거나 비어있으면 1행 사용)
          let outputHeaders = inputHeaders;
          
          if (data.length > 1 && data[1].length > 0) {
              // 2행이 존재하면 해당 행을 출력용 헤더로 사용
              // 빈 셀이 있을 경우를 대비해 처리 (보통 undefined나 null일 수 있음)
              outputHeaders = data[1].map(h => h ? String(h) : '');
          }

          const name = file.name.replace(/\.[^/.]+$/, "");
          
          createTemplate({ name, headers: inputHeaders, outputHeaders })
            .then(() => {
                const msg = data.length > 1 
                    ? `2단 헤더 양식 등록 완료! \n- 매핑용: ${inputHeaders.length}열\n- 출력용: ${outputHeaders.length}열`
                    : `양식 등록 완료! (1단 헤더)`;
                alert(msg);
                loadData();
            })
            .catch((err: any) => alert(err?.message || "양식 생성 중 오류가 발생했습니다."));
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsBulkLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const result = evt.target?.result;
        if (typeof result !== 'string') {
          throw new Error("파일을 읽을 수 없습니다.");
        }
        const wb = XLSX.read(result, { type: 'binary' });
        // Fix: Explicitly check for the sheet name before indexing to avoid type errors
        const firstSheetName = wb.SheetNames[0];
        if (!firstSheetName) throw new Error("엑셀 시트가 없습니다.");
        
        // Fix: Use String() to ensure key is string
        const sheet = wb.Sheets[String(firstSheetName)];
        const data = XLSX.utils.sheet_to_json(sheet as any) as any[];
        
        // [Fix] line 248: Explicitly type Map to ensure values are treated as string and avoid 'unknown' inference
        const templateMap = new Map<string, string>(templates.map(t => [t.name.trim(), t.id]));
        const payload: Omit<Product, 'id' | 'user_id'>[] = [];

        data.forEach((row, idx) => {
          const sku = String(row['SKU(필수)'] || row['SKU'] || row['sku'] || '').trim();
          const name = String(row['제품명(필수)'] || row['제품명'] || row['제품'] || row['name'] || '').trim();
          const supplier = String(row['발주처(필수)'] || row['발주처'] || row['공급처'] || row['supplier'] || '').trim();
          const tplName = String(row['적용양식명(필수)'] || row['적용양식명'] || row['송장양식'] || row['양식'] || row['template'] || '').trim();
          const addName = String(row['대체제품명(선택)'] || row['대체제품명'] || row['additional_name'] || '').trim();
          const useAddNameRaw = String(row['대체제품명사용(Y/N)'] || row['대체제품명사용'] || row['use_additional_name'] || '').trim().toUpperCase();
          
          const tplId = templateMap.get(tplName);
          const useAddName = ['Y', 'YES', '1', 'TRUE', '예'].includes(useAddNameRaw);
          
          if (sku && name && supplier && tplId) {
            payload.push({ 
                sku, 
                name, 
                supplierName: supplier, 
                templateId: tplId, 
                additionalName: addName || undefined, 
                useAdditionalName: useAddName 
            });
          }
        });

        if (payload.length > 0) {
          await createProductsBulk(payload);
          alert(`${payload.length}개의 제품이 성공적으로 등록되었습니다.`);
          loadData();
          setIsBulkModalOpen(false);
        } else {
          alert("등록할 수 있는 유효한 데이터가 없습니다. 열 제목(SKU(필수), 제품명(필수), 발주처(필수), 적용양식명(필수))을 확인하세요.");
        }
      } catch (err: any) {
        alert("업로드 중 오류: " + err.message);
      } finally {
        setIsBulkLoading(false);
        if (bulkFileRef.current) bulkFileRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  const downloadSampleExcel = () => {
    const data = [
      { 
        "SKU(필수)": "PROD-001", 
        "제품명(필수)": "예시 상품", 
        "발주처(필수)": "공급사A", 
        "적용양식명(필수)": templates[0]?.name || "민물장어 송장 형식",
        "대체제품명(선택)": "예시 상품(대체)",
        "대체제품명사용(Y/N)": "Y"
      }
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    
    ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 20 }];
    
    XLSX.utils.book_append_sheet(wb, ws, "Bulk_Sample");
    XLSX.writeFile(wb, "제품_대량등록_양식.xlsx");
  };

  const handleBulkModalOpen = () => {
    if (currentTier.id !== 'gold' && currentTier.id !== 'admin') {
      alert("대량 등록 기능은 '골드 회원' 전용 기능입니다. 멤버십을 업그레이드 해주세요.");
      setActiveTab('account');
      return;
    }
    setIsBulkModalOpen(true);
  };

  const filteredProducts = products.filter(p => p.sku.toLowerCase().includes(searchTerm.toLowerCase()) || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()));
  const currentTier = profile?.tier || { id: 'free', name: '무료 회원', max_products: 2, max_templates: 1 };
  
  const statsBar = (current: number, max: number, label: string) => (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-center text-xs text-slate-600">
          <span className="font-bold">{label}</span>
          <span className="text-slate-400 font-medium">{current} / {max}</span>
      </div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/30">
         <div 
            className={`h-full rounded-full transition-all duration-700 ease-out ${current >= max ? 'bg-red-500' : 'bg-primary'}`} 
            style={{ width: `${Math.min((current/max)*100, 100)}%` }} 
         />
      </div>
    </div>
  );

  const handleSubscriptionLink = (url: string) => {
      if (url) window.open(url, '_blank');
      else alert("준비 중입니다.");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">제품 및 송장 관리</h1>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${currentTier.id === 'gold' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'} border border-opacity-20`}>{currentTier.name}</span>
          </div>
          <p className="text-slate-500 text-xs">{profile?.subscription_end_date ? `만료일: ${new Date(profile.subscription_end_date).toLocaleDateString()}` : '무료 멤버십 이용 중'}</p>
        </div>
      </div>

      <div className="mb-6">
        <nav className="flex space-x-8 border-b border-slate-200">
          {['templates', 'products', 'account'].map(t => (
            <button key={t} onClick={() => setActiveTab(t as any)} className={`${activeTab === t ? 'border-primary text-primary' : 'border-transparent text-slate-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 capitalize transition-all`}>
              {t === 'templates' ? <FileSpreadsheet size={16} /> : t === 'products' ? <Search size={16} /> : <UserCog size={16} />}
              {t === 'templates' ? '송장 양식' : t === 'products' ? '제품 목록' : '계정 정보'}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="py-20 text-center"><RefreshCw className="animate-spin h-10 w-10 text-primary mx-auto mb-4" /><p className="text-slate-500">불러오는 중...</p></div>
      ) : (
        <>
            {activeTab === 'templates' && (
              <>
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-6 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <h3 className="text-indigo-900 font-bold text-lg mb-1">새 송장 양식 등록</h3>
                    <p className="text-indigo-700 text-sm mb-2">엑셀 파일을 업로드하면 열 제목을 자동으로 인식합니다.</p>
                    <div className="text-[11px] text-indigo-500 bg-white/50 p-2 rounded border border-indigo-100 inline-block">
                        <strong>💡 팁: 2단 헤더 지원</strong><br/>
                        1행: 주문서의 열 제목 (매핑용)<br/>
                        2행: 택배사 양식의 열 제목 (출력용)
                    </div>
                  </div>
                  <input type="file" accept=".xlsx, .xls" ref={templateFileRef} className="hidden" onChange={handleTemplateUpload}/>
                  <Button onClick={() => templateFileRef.current?.click()} icon={<Upload size={18} />}>엑셀 업로드</Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {templates.map(tpl => (
                    <div key={tpl.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-600"><FileSpreadsheet size={20} /></div>
                          <div>
                              <h4 className="font-bold text-slate-900">{tpl.name}</h4>
                              <p className="text-[10px] text-slate-500">
                                  {tpl.headers.length}개 열 
                                  {tpl.outputHeaders && JSON.stringify(tpl.headers) !== JSON.stringify(tpl.outputHeaders) && (
                                      <span className="text-indigo-500 font-bold ml-1">(2단 헤더 적용됨)</span>
                                  )}
                              </p>
                          </div>
                        </div>
                        <button onClick={() => handleTemplateDelete(tpl.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                      </div>
                      
                      <div className="space-y-2">
                          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 h-20 overflow-y-auto">
                            <div className="text-[9px] font-bold text-slate-400 mb-1">매핑용 (주문서)</div>
                            <div className="flex flex-wrap gap-1">{tpl.headers.map((h, i) => <span key={i} className="text-[9px] bg-white border px-1.5 rounded text-slate-500">{h}</span>)}</div>
                          </div>
                          
                          {tpl.outputHeaders && JSON.stringify(tpl.headers) !== JSON.stringify(tpl.outputHeaders) && (
                              <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100 h-20 overflow-y-auto">
                                <div className="text-[9px] font-bold text-indigo-400 mb-1">출력용 (택배사)</div>
                                <div className="flex flex-wrap gap-1">{tpl.outputHeaders.map((h, i) => <span key={i} className="text-[9px] bg-white border border-indigo-100 px-1.5 rounded text-indigo-600">{h || '(공란)'}</span>)}</div>
                              </div>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
                <YouTubeEmbed url={appSettings.youtube_tutorial_template} title="송장 양식 등록 가이드" />
              </>
            )}

            {activeTab === 'products' && (
              <>
                <div className="flex justify-end mb-4 gap-2">
                  <Button size="sm" variant="secondary" onClick={handleBulkModalOpen} icon={<FileUp size={16} />}>대량 등록</Button>
                  <Button size="sm" onClick={() => handleOpenProductModal()} icon={<Plus size={16} />}>개별 등록</Button>
                </div>
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-3">
                    <Search className="text-slate-400" size={18} />
                    <input type="text" placeholder="SKU 또는 제품명 검색..." className="bg-transparent border-none focus:ring-0 w-full text-sm outline-none" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b text-slate-500 font-bold uppercase tracking-wider">
                        <tr><th className="px-6 py-3">SKU</th><th className="px-6 py-3">제품명</th><th className="px-6 py-3">발주처</th><th className="px-6 py-3">대체사용</th><th className="px-6 py-3 text-right">관리</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4 font-mono">{p.sku}</td>
                              <td className="px-6 py-4 font-medium">{p.name}</td>
                              <td className="px-6 py-4">{p.supplierName}</td>
                              <td className="px-6 py-4">
                                  {p.useAdditionalName ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-green-50 text-green-600 border border-green-100">사용 중</span>
                                  ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-100">미사용</span>
                                  )}
                              </td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => handleOpenProductModal(p)} className="p-1.5 text-slate-400 hover:text-blue-600"><Pencil size={16} /></button>
                                  <button onClick={() => handleProductDelete(p.id)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                                </div>
                              </td>
                            </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <YouTubeEmbed url={appSettings.youtube_tutorial_product} title="제품 등록 가이드" />
              </>
            )}

            {activeTab === 'account' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-1"><UserCog size={22} className="text-primary" /> 내 정보 및 멤버십</h3>
                                <p className="text-sm text-slate-500">현재 이용 중인 플랜과 개인 정보를 확인하세요.</p>
                            </div>
                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${currentTier.id === 'gold' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-blue-50 text-blue-600 border border-blue-200'}`}>
                                {currentTier.name}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">이메일 계정</label>
                                    <div className="text-base font-bold text-slate-800">{user?.email}</div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">멤버십 만료 예정일</label>
                                    <div className="text-base font-bold text-red-500">
                                        {profile?.subscription_end_date ? new Date(profile.subscription_end_date).toLocaleDateString() : '무제한 (체험 종료 후 무료 전환)'}
                                    </div>
                                </div>
                                <div className="pt-4 border-t border-slate-100">
                                    <button onClick={handleSoftDeleteAccount} className="text-xs text-slate-400 hover:text-red-500 font-medium underline underline-offset-4 transition-colors">서비스 탈퇴하기</button>
                                </div>
                            </div>
                            
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 space-y-6">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                                    <Sparkles size={16} className="text-primary"/> 현재 등급 사용량
                                </div>
                                <div className="space-y-5">
                                    {statsBar(stats.templateCount, currentTier.max_templates, "송장 양식")}
                                    {statsBar(stats.productCount, currentTier.max_products, "제품 등록")}
                                </div>
                                <p className="text-[10px] text-slate-400 leading-relaxed">* 등록 갯수를 초과하면 더 이상 추가할 수 없습니다. 상위 등급으로 업그레이드하세요.</p>
                            </div>
                        </div>
                    </div>

                    {currentTier.id !== 'gold' && (
                        <div className="bg-gradient-to-br from-indigo-600 to-primary rounded-2xl shadow-xl p-8 text-white relative overflow-hidden group">
                            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="text-center md:text-left">
                                    <h4 className="text-2xl font-bold mb-2">더 많은 기능을 원하시나요?</h4>
                                    <p className="text-white/80 text-sm">업무 효율을 2배로 높여주는 상위 플랜으로 지금 바로 업그레이드하세요.</p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                    {currentTier.id === 'free' && (
                                        <button 
                                            onClick={() => handleSubscriptionLink(appSettings.silver_subscription_url)}
                                            className="px-6 py-3 bg-white text-primary rounded-xl font-bold text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-2 shadow-lg"
                                        >
                                            실버로 시작 (5,500원) <ChevronRight size={16}/>
                                        </button>
                                    )}
                                    <button 
                                        onClick={() => handleSubscriptionLink(appSettings.gold_subscription_url)}
                                        className="px-6 py-3 bg-amber-400 text-amber-900 rounded-xl font-bold text-sm hover:bg-amber-300 transition-all flex items-center justify-center gap-2 shadow-lg"
                                    >
                                        골드 업그레이드 (8,800원) <Award size={16}/>
                                    </button>
                                </div>
                            </div>
                            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl group-hover:bg-white/20 transition-all"></div>
                        </div>
                    )}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col h-[600px]">
                      <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2"><History size={20} className="text-slate-400" /> 최근 활동 기록</h3>
                      <div className="flex-1 overflow-y-auto text-xs space-y-3 pr-2 scrollbar-thin">
                          {logs.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                                  <AlertOctagon size={32} strokeWidth={1} />
                                  <p>활동 기록이 없습니다.</p>
                              </div>
                          ) : (
                              logs.map(log => (
                                  <div key={log.id} className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                                      <div className="flex justify-between items-start mb-2">
                                          <span className="font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">{log.action_type}</span>
                                          <span className="text-slate-400 flex items-center gap-1"><Clock size={10}/> {new Date(log.created_at).toLocaleDateString()}</span>
                                      </div>
                                      <p className="text-slate-600 leading-relaxed">{log.description}</p>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              </div>
            )}
        </>
      )}

      {isProductModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800">{editingProductId ? '제품 수정' : '제품 등록'}</h3>
                <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleProductSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">SKU (필수)</label>
                <input required placeholder="예: PROD-101" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={newSku} onChange={e => setNewSku(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">발주처명 (필수)</label>
                <input required placeholder="예: (주)에이비씨" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={newSupplier} onChange={e => setNewSupplier(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">기본 제품명 (필수)</label>
                <input required placeholder="예: 대왕 치즈 스틱" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              
              <div className="pt-2 border-t border-slate-50">
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">대체 제품명 (선택)</label>
                <input placeholder="예: [특가] 대왕 치즈 스틱 1+1" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={newAdditionalName} onChange={e => setNewAdditionalName(e.target.value)} />
              </div>
              
              <div className="flex items-center gap-3 py-2">
                  <button 
                    type="button"
                    onClick={() => setNewUseAdditionalName(!newUseAdditionalName)}
                    className={`w-10 h-5 rounded-full transition-colors relative ${newUseAdditionalName ? 'bg-primary' : 'bg-slate-200'}`}
                  >
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${newUseAdditionalName ? 'left-6' : 'left-1'}`} />
                  </button>
                  <span className="text-xs font-bold text-slate-600">송장 출력 시 대체 제품명 사용</span>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">출력할 송장 양식 (필수)</label>
                <select required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
                    <option value="">송장 양식 선택 *</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-6">
                  <button type="button" onClick={() => setIsProductModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">취소</button>
                  <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/20">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBulkModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-bold flex items-center gap-2 text-slate-800"><FileUp size={18} /> 제품 대량 등록</h3>
                <button onClick={() => setIsBulkModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex flex-col gap-3">
                    <div>
                        <h4 className="text-xs font-bold text-blue-900 mb-1">업로드 가이드</h4>
                        <ul className="text-[11px] text-blue-800 space-y-1.5 list-disc pl-4">
                            <li>엑셀 첫 번째 줄에 아래 열이 반드시 포함되어야 합니다.</li>
                            <li className="font-bold">SKU(필수), 제품명(필수), 발주처(필수), 적용양식명(필수)</li>
                            <li>대체제품명사용(Y/N) 열에 'Y'를 입력하면 대체 제품명이 우선 출력됩니다.</li>
                        </ul>
                    </div>
                    <button 
                        onClick={downloadSampleExcel}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-600 text-white rounded-lg text-[11px] font-bold hover:bg-blue-700 transition-colors w-full shadow-sm"
                    >
                        <Download size={14}/> 샘플 엑셀 다운로드 (추천)
                    </button>
                </div>
                
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-10 hover:border-primary transition-colors bg-slate-50 cursor-pointer group" onClick={() => bulkFileRef.current?.click()}>
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 mb-4 group-hover:scale-110 transition-transform">
                        <FileSpreadsheet size={32} className="text-slate-300 group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-sm font-bold text-slate-700">엑셀 파일 클릭하여 업로드</p>
                    <p className="text-[11px] text-slate-400 mt-1">.xlsx, .xls 파일 지원</p>
                    <input type="file" accept=".xlsx, .xls" ref={bulkFileRef} className="hidden" onChange={handleBulkUpload}/>
                </div>

                {isBulkLoading && (
                    <div className="flex items-center justify-center gap-3 text-primary font-bold animate-pulse">
                        <RefreshCw className="animate-spin" size={20}/>
                        <span className="text-sm">데이터 파싱 및 저장 중...</span>
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-50 mt-2">
                    <button onClick={() => setIsBulkModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-500 bg-white border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">닫기</button>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
