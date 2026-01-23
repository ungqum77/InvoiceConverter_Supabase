
import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Search, Save, X, FileSpreadsheet, Upload, Settings2, Building2, Tag, CheckSquare, Pencil, Lock, Zap, UserCog, LogOut, AlertOctagon, Calendar, History, Clock, Download, ArrowUpCircle, CreditCard, Award, Youtube, AlertTriangle, RefreshCw, ExternalLink, Sparkles, ChevronRight, FileUp, Check, ArrowDownCircle, DollarSign, PackageCheck } from 'lucide-react';
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
  
  // Product Fields
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [newAdditionalName, setNewAdditionalName] = useState('');
  const [newUseAdditionalName, setNewUseAdditionalName] = useState(false);

  // Financial Fields
  const [salesPrice, setSalesPrice] = useState(0);
  const [purchaseCost, setPurchaseCost] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [marketFeeRate, setMarketFeeRate] = useState(0);

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
      // Financials
      setSalesPrice(productToEdit.salesPrice || 0);
      setPurchaseCost(productToEdit.purchaseCost || 0);
      setShippingCost(productToEdit.shippingCost || 0);
      setOtherCost(productToEdit.otherCost || 0);
      setMarketFeeRate(productToEdit.marketFeeRate || 0);
    } else {
      setEditingProductId(null);
      setNewSku('');
      setNewName('');
      setNewSupplier('');
      setSelectedTemplateId('');
      setNewAdditionalName('');
      setNewUseAdditionalName(false);
      // Reset Financials
      setSalesPrice(0);
      setPurchaseCost(0);
      setShippingCost(0);
      setOtherCost(0);
      setMarketFeeRate(0);
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
        useAdditionalName: newUseAdditionalName,
        // Financials
        salesPrice,
        purchaseCost,
        shippingCost,
        otherCost,
        marketFeeRate
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
          const inputHeaders = data[0].map(h => String(h));
          let outputHeaders = inputHeaders;
          if (data.length > 1 && data[1].length > 0) {
              outputHeaders = data[1].map(h => h ? String(h) : '');
          }
          const name = file.name.replace(/\.[^/.]+$/, "");
          createTemplate({ name, headers: inputHeaders, outputHeaders })
            .then(() => {
                alert(`양식 등록 완료!`);
                loadData();
            })
            .catch((err: any) => alert(err?.message || "양식 생성 중 오류"));
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // Bulk Upload updated to include financials
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsBulkLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const result = evt.target?.result;
        if (typeof result !== 'string') throw new Error("파일 읽기 오류");
        const wb = XLSX.read(result, { type: 'binary' });
        const firstSheetName = wb.SheetNames[0];
        if (!firstSheetName) throw new Error("시트 없음");
        
        const sheet = wb.Sheets[String(firstSheetName)];
        const data = XLSX.utils.sheet_to_json(sheet as any) as any[];
        
        const templateMap = new Map<string, string>(templates.map(t => [t.name.trim(), t.id]));
        const payload: Omit<Product, 'id' | 'user_id'>[] = [];

        data.forEach((row, idx) => {
          const sku = String(row['SKU(필수)'] || row['SKU'] || '').trim();
          const name = String(row['제품명(필수)'] || row['제품명'] || '').trim();
          const supplier = String(row['발주처(필수)'] || row['발주처'] || '').trim();
          const tplName = String(row['적용양식명(필수)'] || row['적용양식명'] || '').trim();
          
          const tplId = templateMap.get(tplName);
          
          if (sku && name && supplier && tplId) {
            payload.push({ 
                sku, name, supplierName: supplier, templateId: tplId,
                additionalName: String(row['대체제품명'] || '').trim() || undefined,
                useAdditionalName: ['Y', 'YES', '1'].includes(String(row['대체제품명사용'] || '').trim().toUpperCase()),
                salesPrice: Number(row['판매가'] || 0),
                purchaseCost: Number(row['매입가'] || 0),
                shippingCost: Number(row['배송비'] || 0),
                otherCost: Number(row['기타비용'] || 0),
                marketFeeRate: Number(row['수수료율'] || 0)
            });
          }
        });

        if (payload.length > 0) {
          await createProductsBulk(payload);
          alert(`${payload.length}개의 제품 등록 완료`);
          loadData();
          setIsBulkModalOpen(false);
        } else {
          alert("유효한 데이터가 없습니다.");
        }
      } catch (err: any) { alert("오류: " + err.message); } finally { setIsBulkLoading(false); }
    };
    reader.readAsBinaryString(file);
  };

  const downloadSampleExcel = () => {
    const data = [{ 
        "SKU(필수)": "PROD-001", "제품명(필수)": "샘플상품", "발주처(필수)": "공급사A", "적용양식명(필수)": templates[0]?.name || "기본양식",
        "대체제품명": "", "대체제품명사용": "N",
        "판매가": 10000, "매입가": 5000, "배송비": 3000, "기타비용": 500, "수수료율": 10
    }];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    XLSX.writeFile(wb, "대량등록_양식_CRM.xlsx");
  };

  const handleBulkModalOpen = () => {
    if (currentTier.id !== 'gold' && currentTier.id !== 'admin') {
      alert("대량 등록은 골드 회원 전용입니다.");
      setActiveTab('account');
      return;
    }
    setIsBulkModalOpen(true);
  };

  const filteredProducts = products.filter(p => p.sku.toLowerCase().includes(searchTerm.toLowerCase()) || p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.supplierName.toLowerCase().includes(searchTerm.toLowerCase()));
  const currentTier = profile?.tier || { id: 'free', name: '무료 회원', max_products: 2, max_templates: 1 };
  
  const statsBar = (current: number, max: number, label: string) => (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex justify-between items-center text-xs text-slate-600"><span className="font-bold">{label}</span><span className="text-slate-400 font-medium">{current} / {max}</span></div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/30"><div className={`h-full rounded-full transition-all duration-700 ease-out ${current >= max ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${Math.min((current/max)*100, 100)}%` }} /></div>
    </div>
  );

  const handleSubscriptionLink = (url: string) => { if (url) window.open(url, '_blank'); else alert("준비 중입니다."); };

  // Helper to estimate profit for UI
  const estProfit = (p: number, c: number, f: number) => {
      return p - c - (p * (f/100));
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
              {t === 'templates' ? '송장 양식' : t === 'products' ? '제품 목록 (CRM)' : '계정 정보'}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="py-20 text-center"><RefreshCw className="animate-spin h-10 w-10 text-primary mx-auto mb-4" /><p className="text-slate-500">불러오는 중...</p></div>
      ) : (
        <>
            {/* Templates Tab (No Changes) */}
            {activeTab === 'templates' && (
              <>
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-6 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <h3 className="text-indigo-900 font-bold text-lg mb-1">새 송장 양식 등록</h3>
                    <p className="text-indigo-700 text-sm mb-2">엑셀 파일을 업로드하면 열 제목을 자동으로 인식합니다.</p>
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
                          <div><h4 className="font-bold text-slate-900">{tpl.name}</h4><p className="text-[10px] text-slate-500">{tpl.headers.length}개 열</p></div>
                        </div>
                        <button onClick={() => handleTemplateDelete(tpl.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 h-20 overflow-y-auto"><div className="flex flex-wrap gap-1">{tpl.headers.map((h, i) => <span key={i} className="text-[9px] bg-white border px-1.5 rounded text-slate-500">{h}</span>)}</div></div>
                    </div>
                  ))}
                </div>
                <YouTubeEmbed url={appSettings.youtube_tutorial_template} title="송장 양식 등록 가이드" />
              </>
            )}

            {/* Products Tab (Financials Added) */}
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
                        <tr>
                            <th className="px-6 py-3">SKU</th>
                            <th className="px-6 py-3">제품명</th>
                            <th className="px-6 py-3">발주처</th>
                            <th className="px-6 py-3 text-right">매입가</th>
                            <th className="px-6 py-3 text-right">판매가</th>
                            <th className="px-6 py-3 text-right text-indigo-600">예상마진</th>
                            <th className="px-6 py-3 text-right">관리</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredProducts.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="px-6 py-4 font-mono">{p.sku}</td>
                              <td className="px-6 py-4 font-medium">{p.name}</td>
                              <td className="px-6 py-4">{p.supplierName}</td>
                              <td className="px-6 py-4 text-right font-mono text-slate-500">{p.purchaseCost?.toLocaleString()}</td>
                              <td className="px-6 py-4 text-right font-mono font-bold">{p.salesPrice?.toLocaleString()}</td>
                              <td className="px-6 py-4 text-right font-mono text-indigo-600 font-bold">
                                  {estProfit(p.salesPrice || 0, p.purchaseCost || 0, p.marketFeeRate || 0).toLocaleString()}
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

            {/* Account Tab (No Changes) */}
            {activeTab === 'account' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                        <div className="flex justify-between items-start mb-8">
                            <div><h3 className="text-xl font-bold text-slate-900 flex items-center gap-2 mb-1"><UserCog size={22} className="text-primary" /> 내 정보 및 멤버십</h3></div>
                            <span className={`px-4 py-1.5 rounded-full text-xs font-bold ${currentTier.id === 'gold' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>{currentTier.name}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                            <div className="space-y-6">
                                <div><div className="text-[10px] uppercase font-bold text-slate-400">이메일</div><div className="text-base font-bold">{user?.email}</div></div>
                                <div className="pt-4 border-t border-slate-100"><button onClick={handleSoftDeleteAccount} className="text-xs text-red-400 hover:underline">서비스 탈퇴</button></div>
                            </div>
                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200/60 space-y-6">
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2"><Sparkles size={16} className="text-primary"/> 현재 등급 사용량</div>
                                <div className="space-y-5">{statsBar(stats.templateCount, currentTier.max_templates, "송장 양식")}{statsBar(stats.productCount, currentTier.max_products, "제품 등록")}</div>
                            </div>
                        </div>
                    </div>
                  </div>
              </div>
            )}
        </>
      )}

      {isProductModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in my-8">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-800">{editingProductId ? '제품 수정 (CRM)' : '제품 등록 (CRM)'}</h3>
                <button onClick={() => setIsProductModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleProductSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* 기본 정보 */}
              <div className="space-y-4 md:col-span-2">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-2 border-b"><PackageCheck size={16}/> 기본 제품 정보</h4>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">SKU (필수)</label>
                <input required placeholder="예: PROD-101" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none" value={newSku} onChange={e => setNewSku(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">제품명 (필수)</label>
                <input required placeholder="예: 대왕 치즈 스틱" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">발주처명 (필수)</label>
                <input required placeholder="예: (주)에이비씨" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none" value={newSupplier} onChange={e => setNewSupplier(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">송장 양식 (필수)</label>
                <select required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-primary/20 outline-none" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
                    <option value="">송장 양식 선택 *</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              {/* 대체 제품명 */}
              <div className="md:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3 mb-2">
                     <span className="text-xs font-bold text-slate-600">대체 제품명 사용</span>
                     <button type="button" onClick={() => setNewUseAdditionalName(!newUseAdditionalName)} className={`w-9 h-5 rounded-full relative transition-colors ${newUseAdditionalName ? 'bg-primary' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${newUseAdditionalName ? 'left-5' : 'left-1'}`} />
                     </button>
                  </div>
                  {newUseAdditionalName && (
                      <input placeholder="송장에 출력될 대체 이름" className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white" value={newAdditionalName} onChange={e => setNewAdditionalName(e.target.value)} />
                  )}
              </div>

              {/* CRM Financial Info */}
              <div className="space-y-4 md:col-span-2 pt-4">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2 pb-2 border-b"><DollarSign size={16}/> 재무/정산 정보 (CRM)</h4>
              </div>

              <div>
                <label className="text-[11px] font-bold text-blue-600 mb-1.5 block">판매가 (매출액)</label>
                <input type="number" className="w-full rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-900 focus:ring-2 focus:ring-blue-500/20 outline-none" value={salesPrice} onChange={e => setSalesPrice(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-red-500 mb-1.5 block">매입가 (발주처 지급액)</label>
                <input type="number" className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-900 focus:ring-2 focus:ring-red-500/20 outline-none" value={purchaseCost} onChange={e => setPurchaseCost(Number(e.target.value))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">택배비용</label>
                    <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" value={shippingCost} onChange={e => setShippingCost(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">기타비용</label>
                    <input type="number" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm" value={otherCost} onChange={e => setOtherCost(Number(e.target.value))} />
                  </div>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">마켓 수수료율 (%)</label>
                <div className="relative">
                    <input type="number" step="0.1" className="w-full rounded-lg border border-slate-200 pl-3 pr-8 py-2.5 text-sm" value={marketFeeRate} onChange={e => setMarketFeeRate(Number(e.target.value))} />
                    <span className="absolute right-3 top-2.5 text-sm text-slate-400">%</span>
                </div>
              </div>

              {/* Profit Preview */}
              <div className="md:col-span-2 bg-indigo-50 border border-indigo-100 rounded-lg p-4 flex justify-between items-center">
                  <span className="text-xs font-bold text-indigo-800">예상 개당 순수익</span>
                  <span className="text-lg font-black text-indigo-600">
                      {estProfit(salesPrice, purchaseCost, marketFeeRate).toLocaleString()} 원
                  </span>
              </div>

              <div className="md:col-span-2 flex justify-end gap-2 pt-4 border-t border-slate-100">
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
            {/* ... Same Bulk Upload UI ... */}
             <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
                <h3 className="font-bold flex items-center gap-2 text-slate-800"><FileUp size={18} /> 제품 대량 등록</h3>
                <button onClick={() => setIsBulkModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-6">
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex flex-col gap-3">
                    <button onClick={downloadSampleExcel} className="flex items-center justify-center gap-2 py-2.5 px-3 bg-blue-600 text-white rounded-lg text-[11px] font-bold hover:bg-blue-700 transition-colors w-full shadow-sm"><Download size={14}/> 샘플 엑셀 다운로드 (CRM 포함)</button>
                </div>
                <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl p-10 hover:border-primary transition-colors bg-slate-50 cursor-pointer group" onClick={() => bulkFileRef.current?.click()}>
                    <FileSpreadsheet size={32} className="text-slate-300 group-hover:text-primary transition-colors mb-2" />
                    <p className="text-sm font-bold text-slate-700">엑셀 파일 업로드</p>
                    <input type="file" accept=".xlsx, .xls" ref={bulkFileRef} className="hidden" onChange={handleBulkUpload}/>
                </div>
                {isBulkLoading && <div className="text-center text-primary font-bold text-sm">처리 중...</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
