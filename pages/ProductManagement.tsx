
import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Plus, Trash2, Search, Save, X, FileSpreadsheet, Upload, Settings2, Building2, Tag, CheckSquare, Pencil, Lock, Zap, UserCog, LogOut, AlertOctagon, Calendar, History, Clock, Download, ArrowUpCircle, CreditCard, Award, Youtube, AlertTriangle, RefreshCw, ExternalLink, Sparkles, ChevronRight, FileUp, Check, ArrowDownCircle, DollarSign, PackageCheck } from 'lucide-react';
import { Product, InvoiceTemplate, UserProfile, ActivityLog, Tier, Supplier, VatType } from '../types';
import { fetchProducts, createProduct, updateProduct, deleteProduct, fetchTemplates, createTemplate, deleteTemplate, getUserProfile, getUsageStats, createProductsBulk, fetchActivityLogs, fetchAppSettings, AppSettings, trackEvent, fetchSuppliers, createSupplier, updateSupplier, deleteSupplier, migrateSuppliersFromProducts, getSchemaSupport, resetSchemaCache, SchemaSupport } from '../services/dbService';
import { calcProfit } from '../services/calc';
import { supabase } from '../services/supabase';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BulkProductImport } from '../components/BulkProductImport';

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
  
  const [activeTab, setActiveTab] = useState<'templates' | 'suppliers' | 'products' | 'account'>('templates');
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [schema, setSchema] = useState<SchemaSupport>({ suppliers: false, productVat: false, salesVat: false });
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState({ productCount: 0, templateCount: 0 });
  // Fix: Initial state for appSettings was missing price properties required by AppSettings type
  const [appSettings, setAppSettings] = useState<AppSettings>({
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
  const [loading, setLoading] = useState(true);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  
  // Product Fields
  const [newSku, setNewSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [newSupplierId, setNewSupplierId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [newAdditionalName, setNewAdditionalName] = useState('');
  const [newUseAdditionalName, setNewUseAdditionalName] = useState(false);

  // Financial Fields
  const [salesPrice, setSalesPrice] = useState(0);
  const [purchaseCost, setPurchaseCost] = useState(0);
  const [shippingCost, setShippingCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [marketFeeRate, setMarketFeeRate] = useState(0);
  const [vatType, setVatType] = useState<VatType>('taxable');

  // Supplier modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const blankSupplier = { name: '', code: '', manager: '', phone: '', email: '', bizNo: '', paymentTerms: '', vatIncluded: true, memo: '' };
  const [supplierForm, setSupplierForm] = useState<Omit<Supplier, 'id' | 'user_id'>>(blankSupplier);

  const templateFileRef = useRef<HTMLInputElement>(null);
  const [isTemplateUploading, setIsTemplateUploading] = useState(false);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'account' || tabParam === 'products' || tabParam === 'templates' || tabParam === 'suppliers') setActiveTab(tabParam);
  }, [searchParams]);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (user) {
          const schemaData = await getSchemaSupport();
          setSchema(schemaData);
          const [prodData, tplData, userData, usageData, logData, settingsData, supData] = await Promise.all([
            fetchProducts(),
            fetchTemplates(),
            getUserProfile(user.id),
            getUsageStats(user.id),
            fetchActivityLogs(user.id),
            fetchAppSettings(),
            fetchSuppliers()
          ]);
          setProducts(prodData);
          setTemplates(tplData);
          if (userData) setProfile(userData);
          if (usageData) setStats(usageData);
          setLogs(logData);
          setAppSettings(settingsData);
          setSuppliers(supData);
      }
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSoftDeleteAccount = async () => {
      if (!window.confirm("정말로 탈퇴하시겠습니까?")) return;
      const confirmEmail = prompt("이메일 주소를 다시 입력해주세요.");
      if (confirmEmail !== user?.email) { alert("일치하지 않습니다."); return; }
      try {
          if (supabase) await supabase.auth.updateUser({ data: { status: 'deleted', deleted_at: new Date().toISOString() } });
          trackEvent('delete_account', { reason: 'user_request' });
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
      setNewSupplierId(
        productToEdit.supplierId
        || suppliers.find(s => s.name.trim() === String(productToEdit.supplierName || '').trim())?.id
        || ''
      );
      setSelectedTemplateId(productToEdit.templateId);
      setNewAdditionalName(productToEdit.additionalName || '');
      setNewUseAdditionalName(productToEdit.useAdditionalName || false);
      // Financials
      setSalesPrice(productToEdit.salesPrice || 0);
      setPurchaseCost(productToEdit.purchaseCost || 0);
      setShippingCost(productToEdit.shippingCost || 0);
      setOtherCost(productToEdit.otherCost || 0);
      setMarketFeeRate(productToEdit.marketFeeRate || 0);
      setVatType(productToEdit.vatType || 'taxable');
    } else {
      setEditingProductId(null);
      setNewSku('');
      setNewName('');
      setNewSupplier('');
      setNewSupplierId('');
      setSelectedTemplateId('');
      setNewAdditionalName('');
      setNewUseAdditionalName(false);
      // Reset Financials
      setSalesPrice(0);
      setPurchaseCost(0);
      setShippingCost(0);
      setOtherCost(0);
      setMarketFeeRate(0);
      setVatType('taxable');
    }
    setIsProductModalOpen(true);
  };

  /** 발주처 마스터를 쓰는 경우 선택된 id에서 이름을 가져온다(오타로 업체가 갈라지는 것을 방지). */
  const resolvedSupplierName = schema.suppliers
    ? (suppliers.find(s => s.id === newSupplierId)?.name || '')
    : newSupplier;

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSku || !newName || !resolvedSupplierName || !selectedTemplateId) return;

    // [중복 체크] SKU 중복 확인
    const normalizedSku = newSku.trim();
    const isDuplicateSku = products.some(p => 
        p.sku === normalizedSku && p.id !== editingProductId
    );

    if (isDuplicateSku) {
        alert(`이미 존재하는 SKU입니다: ${normalizedSku}\n다른 SKU를 입력해주세요.`);
        return;
    }

    try {
      const payload = {
        sku: normalizedSku,
        name: newName,
        supplierName: resolvedSupplierName,
        supplierId: schema.suppliers ? (newSupplierId || undefined) : undefined,
        templateId: selectedTemplateId,
        additionalName: newAdditionalName,
        useAdditionalName: newUseAdditionalName,
        // Financials
        salesPrice,
        purchaseCost,
        shippingCost,
        otherCost,
        marketFeeRate,
        vatType
      };
      if (editingProductId) await updateProduct(editingProductId, payload);
      else await createProduct(payload);
      setIsProductModalOpen(false);
      loadData();
    } catch (error: any) { alert(error.message); }
  };

  const handleProductDelete = async (id: string) => { if (window.confirm('삭제하시겠습니까?')) { await deleteProduct(id); loadData(); } };

  /* ------------------------- 발주처 관리 ------------------------- */

  const openSupplierModal = (s?: Supplier) => {
    if (s) {
      setEditingSupplierId(s.id);
      setSupplierForm({
        name: s.name, code: s.code || '', manager: s.manager || '', phone: s.phone || '',
        email: s.email || '', bizNo: s.bizNo || '', paymentTerms: s.paymentTerms || '',
        vatIncluded: s.vatIncluded, memo: s.memo || '',
      });
    } else {
      setEditingSupplierId(null);
      setSupplierForm(blankSupplier);
    }
    setIsSupplierModalOpen(true);
  };

  const handleSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = supplierForm.name.trim();
    if (!name) return;
    if (suppliers.some(s => s.name.trim() === name && s.id !== editingSupplierId)) {
      alert(`이미 등록된 발주처입니다: ${name}`);
      return;
    }
    try {
      if (editingSupplierId) await updateSupplier(editingSupplierId, supplierForm);
      else await createSupplier(supplierForm);
      setIsSupplierModalOpen(false);
      loadData();
    } catch (err: any) { alert(err.message); }
  };

  const handleSupplierDelete = async (s: Supplier) => {
    if (!window.confirm(`'${s.name}' 발주처를 삭제하시겠습니까?`)) return;
    try { await deleteSupplier(s.id); loadData(); }
    catch (err: any) { alert(err.message); }
  };

  const handleMigrateSuppliers = async () => {
    if (!window.confirm(
      '제품에 입력된 발주처명을 읽어 발주처 목록을 자동으로 만들고 연결합니다.\n' +
      '기존 데이터는 지워지지 않으며, 여러 번 실행해도 안전합니다.\n\n진행할까요?'
    )) return;
    setIsMigrating(true);
    try {
      const { created, linked } = await migrateSuppliersFromProducts();
      alert(`발주처 ${created}곳을 새로 만들고, 제품 ${linked}건을 연결했습니다.`);
      loadData();
    } catch (err: any) { alert('이관 중 오류: ' + err.message); }
    finally { setIsMigrating(false); }
  };

  /** 발주처별 제품 수 */
  const productCountBySupplier = (s: Supplier) =>
    products.filter(p => p.supplierId === s.id || (!p.supplierId && p.supplierName?.trim() === s.name.trim())).length;

  /** 발주처 마스터에 없는 발주처명(오타 의심) */
  const orphanSupplierNames = Array.from(new Set(
    products.filter(p => !p.supplierId).map(p => String(p.supplierName || '').trim()).filter(Boolean)
  )).filter(n => !suppliers.some(s => s.name.trim() === n));
  
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

  const readAsBinary = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = evt => {
      const r = evt.target?.result;
      typeof r === 'string' ? resolve(r) : reject(new Error('파일을 읽지 못했습니다.'));
    };
    reader.onerror = () => reject(new Error('파일을 읽지 못했습니다.'));
    reader.readAsBinaryString(file);
  });

  /**
   * 송장 양식 업로드. 발주처마다 양식이 따로라 한 번에 여러 개를 올리는 일이 잦아
   * 파일을 여러 개 받는다. 한 파일이 실패해도 나머지는 계속 등록하고, 끝에 한 번만 알린다.
   */
  const handleTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    e.target.value = '';
    if (files.length === 0) return;

    setIsTemplateUploading(true);
    const room = currentTier.max_templates - templates.length;   // 등급 한도까지 남은 개수
    const taken = new Set(templates.map(t => t.name));           // 이번 배치에서 생긴 이름까지 누적
    const done: string[] = [];
    const failed: string[] = [];

    for (const file of files) {
      const name = file.name.replace(/\.[^/.]+$/, '').trim();
      try {
        if (done.length >= room) { failed.push(`${name}: 등급 한도(${currentTier.max_templates}개) 초과`); continue; }
        if (taken.has(name)) { failed.push(`${name}: 이미 있는 양식 이름`); continue; }

        const wb = XLSX.read(await readAsBinary(file), { type: 'binary' });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error('시트가 없습니다');
        const data = XLSX.utils.sheet_to_json(wb.Sheets[String(sheetName)] as any, { header: 1 }) as any[][];
        if (data.length === 0 || !data[0]?.length) throw new Error('1행에 열 제목이 없습니다');

        const inputHeaders = data[0].map(h => String(h ?? ''));
        const outputHeaders = (data.length > 1 && data[1].length > 0)
          ? data[1].map(h => (h ? String(h) : ''))
          : inputHeaders;

        await createTemplate({ name, headers: inputHeaders, outputHeaders });
        taken.add(name);
        done.push(`${name} (${inputHeaders.length}개 열)`);
      } catch (err: any) {
        failed.push(`${name}: ${err?.message || '등록 실패'}`);
      }
    }

    setIsTemplateUploading(false);
    if (done.length > 0) await loadData();

    const lines: string[] = [];
    if (done.length > 0) lines.push(`✅ ${done.length}개 등록 완료\n${done.join('\n')}`);
    if (failed.length > 0) lines.push(`⛔ ${failed.length}개 실패\n${failed.join('\n')}`);
    alert(lines.join('\n\n'));
  };

  /** 등록해둔 양식을 다시 엑셀로 받는다. 1행=매칭용 제목, 2행=출력용 제목. */
  const handleTemplateDownload = (tpl: InvoiceTemplate) => {
    const rows: string[][] = [tpl.headers.map(h => String(h))];
    if (tpl.outputHeaders && tpl.outputHeaders.length > 0) rows.push(tpl.outputHeaders.map(h => String(h ?? '')));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Sheet1');
    XLSX.writeFile(wb, `${tpl.name}.xlsx`);
  };

  // 대량 등록 화면에서 검증까지 끝난 데이터만 넘어온다.
  const handleBulkSubmit = async (payload: Omit<Product, 'id' | 'user_id'>[]) => {
    await createProductsBulk(payload);
    await loadData();
    alert(`${payload.length}건 등록 완료!`);
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

  // 개당 예상 순수익. 계산식은 services/calc.ts 한 곳에만 존재한다.
  const estProfit = (product: Partial<Product>) => {
      const supplier = product.supplierId
          ? suppliers.find(s => s.id === product.supplierId)
          : suppliers.find(s => s.name.trim() === String(product.supplierName || '').trim());
      return calcProfit({
          salesPrice: product.salesPrice,
          purchaseCost: product.purchaseCost,
          shippingCost: product.shippingCost,
          otherCost: product.otherCost,
          marketFeeRate: product.marketFeeRate,
          vatType: product.vatType,
          costIncludesVat: supplier?.vatIncluded ?? true,
          qty: 1,
      }).netProfit;
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
          {['templates', 'suppliers', 'products', 'account'].map(t => (
            <button key={t} onClick={() => setActiveTab(t as any)} className={`${activeTab === t ? 'border-primary text-primary' : 'border-transparent text-slate-500'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 capitalize transition-all`}>
              {t === 'templates' ? <FileSpreadsheet size={16} /> : t === 'suppliers' ? <Building2 size={16} /> : t === 'products' ? <Search size={16} /> : <UserCog size={16} />}
              {t === 'templates' ? '송장 양식' : t === 'suppliers' ? '발주처' : t === 'products' ? '제품 목록 (CRM)' : '계정 정보'}
              {t === 'suppliers' && orphanSupplierNames.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{orphanSupplierNames.length}</span>
              )}
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
                    <p className="text-indigo-500 text-xs">파일을 <b>여러 개 한꺼번에</b> 고르셔도 됩니다. 파일 이름이 곧 양식 이름이 됩니다.</p>
                  </div>
                  <input type="file" accept=".xlsx, .xls" multiple ref={templateFileRef} className="hidden" onChange={handleTemplateUpload}/>
                  <Button onClick={() => templateFileRef.current?.click()} disabled={isTemplateUploading} icon={<Upload size={18} />}>
                    {isTemplateUploading ? '등록 중…' : '엑셀 업로드'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {templates.map(tpl => (
                    <div key={tpl.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-green-600"><FileSpreadsheet size={20} /></div>
                          <div><h4 className="font-bold text-slate-900">{tpl.name}</h4><p className="text-[10px] text-slate-500">{tpl.headers.length}개 열</p></div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleTemplateDownload(tpl)} title="이 양식을 엑셀로 내려받기"
                            className="text-slate-400 hover:text-primary p-1"><Download size={16} /></button>
                          <button onClick={() => handleTemplateDelete(tpl.id)} title="삭제"
                            className="text-slate-400 hover:text-red-500 p-1"><Trash2 size={16} /></button>
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 h-20 overflow-y-auto"><div className="flex flex-wrap gap-1">{tpl.headers.map((h, i) => <span key={i} className="text-[9px] bg-white border px-1.5 rounded text-slate-500">{h}</span>)}</div></div>
                    </div>
                  ))}
                </div>
                <YouTubeEmbed url={appSettings.youtube_tutorial_template} title="송장 양식 등록 가이드" />
              </>
            )}

            {/* Suppliers Tab (New) */}
            {activeTab === 'suppliers' && (
              <>
                {!schema.suppliers ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                    <h3 className="font-bold text-amber-900 flex items-center gap-2 mb-2"><AlertTriangle size={18}/> 발주처 기능을 아직 쓸 수 없습니다</h3>
                    <p className="text-sm text-amber-800 leading-relaxed">
                      데이터베이스에 <code className="bg-white px-1.5 py-0.5 rounded border text-xs">suppliers</code> 테이블이 없습니다.
                      프로젝트의 <code className="bg-white px-1.5 py-0.5 rounded border text-xs">supabase/migration.sql</code> 내용을
                      Supabase 대시보드의 SQL Editor에 붙여넣고 실행한 뒤 아래 버튼을 눌러주세요.
                      <br />기존 기능은 그대로 동작하며, 실행 전까지 발주처는 제품에 입력한 이름으로만 처리됩니다.
                    </p>
                    <Button size="sm" className="mt-4" icon={<RefreshCw size={14}/>} onClick={() => { resetSchemaCache(); loadData(); }}>
                      적용 여부 다시 확인
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                      <p className="text-xs text-slate-500">
                        발주처를 여기에 등록해두면 제품 등록 시 <b>목록에서 선택</b>하게 되어, 오타로 같은 업체가 둘로 갈라지는 일이 없어집니다.
                      </p>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="secondary" isLoading={isMigrating} onClick={handleMigrateSuppliers} icon={<ArrowDownCircle size={16} />}>기존 제품에서 가져오기</Button>
                        <Button size="sm" onClick={() => openSupplierModal()} icon={<Plus size={16} />}>발주처 등록</Button>
                      </div>
                    </div>

                    {orphanSupplierNames.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                        <div className="font-bold text-amber-900 text-xs mb-2 flex items-center gap-1.5">
                          <AlertTriangle size={14}/> 발주처 목록에 없는 이름이 제품에 {orphanSupplierNames.length}개 남아 있습니다
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {orphanSupplierNames.map(n => (
                            <span key={n} className="text-[11px] bg-white border border-amber-200 px-2 py-0.5 rounded text-amber-800">{n}</span>
                          ))}
                        </div>
                        <p className="text-[10px] text-amber-700 mt-2">'기존 제품에서 가져오기'를 누르면 자동으로 등록·연결됩니다.</p>
                      </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 border-b text-slate-500 font-bold uppercase tracking-wider">
                            <tr>
                              <th className="px-6 py-3">발주처명</th>
                              <th className="px-6 py-3">담당자</th>
                              <th className="px-6 py-3">연락처</th>
                              <th className="px-6 py-3">결제조건</th>
                              <th className="px-6 py-3 text-center">매입가 기준</th>
                              <th className="px-6 py-3 text-right">연결 제품</th>
                              <th className="px-6 py-3 text-right">관리</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {suppliers.length === 0 && (
                              <tr><td colSpan={7} className="px-6 py-10 text-center text-slate-400">
                                등록된 발주처가 없습니다. '기존 제품에서 가져오기'로 한 번에 만들 수 있습니다.
                              </td></tr>
                            )}
                            {suppliers.map(s => (
                              <tr key={s.id} className="hover:bg-slate-50">
                                <td className="px-6 py-4 font-bold text-slate-800">
                                  {s.name}
                                  {s.code && <span className="ml-2 text-[10px] font-mono text-slate-400">{s.code}</span>}
                                </td>
                                <td className="px-6 py-4">{s.manager || '-'}</td>
                                <td className="px-6 py-4 font-mono text-slate-500">{s.phone || '-'}</td>
                                <td className="px-6 py-4">{s.paymentTerms || '-'}</td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${s.vatIncluded ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-600'}`}>
                                    {s.vatIncluded ? '부가세 포함' : '부가세 별도'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right font-mono">{productCountBySupplier(s)}</td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    <button onClick={() => openSupplierModal(s)} className="p-1.5 text-slate-400 hover:text-blue-600"><Pencil size={16} /></button>
                                    <button onClick={() => handleSupplierDelete(s)} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={16} /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
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
                                  {estProfit(p).toLocaleString()}
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
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">발주처 (필수)</label>
                {schema.suppliers ? (
                  <>
                    <select required className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white focus:ring-2 focus:ring-primary/20 outline-none" value={newSupplierId} onChange={e => setNewSupplierId(e.target.value)}>
                        <option value="">발주처 선택 *</option>
                        {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button type="button" onClick={() => { setIsProductModalOpen(false); setActiveTab('suppliers'); openSupplierModal(); }} className="text-[10px] text-primary hover:underline mt-1">+ 새 발주처 등록하기</button>
                  </>
                ) : (
                  <input required placeholder="예: (주)에이비씨" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 outline-none" value={newSupplier} onChange={e => setNewSupplier(e.target.value)} />
                )}
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
                <p className="text-[10px] text-slate-400 mt-1">
                  {(suppliers.find(s => s.id === newSupplierId)?.vatIncluded ?? true)
                    ? '이 발주처는 매입가를 부가세 포함으로 봅니다.'
                    : '이 발주처는 매입가를 부가세 별도로 봅니다 (지급 시 10% 추가).'}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">과세 구분</label>
                <div className="flex gap-2">
                  {([['taxable', '과세 (부가세 10%)'], ['exempt', '면세 (부가세 없음)']] as [VatType, string][]).map(([v, label]) => (
                    <button key={v} type="button" onClick={() => setVatType(v)}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold border transition-colors ${vatType === v ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {!schema.productVat && (
                  <p className="text-[10px] text-amber-600 mt-1">* 마이그레이션 SQL 실행 전이라 과세 구분은 아직 저장되지 않습니다.</p>
                )}
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
                      {estProfit({ salesPrice, purchaseCost, shippingCost, otherCost, marketFeeRate, vatType, supplierId: newSupplierId, supplierName: resolvedSupplierName }).toLocaleString()} 원
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

      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in my-8">
            <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2"><Building2 size={18}/> {editingSupplierId ? '발주처 수정' : '발주처 등록'}</h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSupplierSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">발주처명 (필수)</label>
                <input required autoFocus placeholder="예: (주)한일식품" className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} />
              </div>
              {([
                ['code', '관리 코드', '예: A01'],
                ['manager', '담당자', '예: 김철수'],
                ['phone', '연락처', '예: 010-1234-5678'],
                ['email', '이메일', '예: kim@hanil.co.kr'],
                ['bizNo', '사업자등록번호', '예: 123-45-67890'],
                ['paymentTerms', '결제조건', '예: 월말결산 익월 15일'],
              ] as [keyof typeof supplierForm, string, string][]).map(([key, label, ph]) => (
                <div key={String(key)}>
                  <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">{label}</label>
                  <input placeholder={ph} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    value={String(supplierForm[key] ?? '')} onChange={e => setSupplierForm({ ...supplierForm, [key]: e.target.value })} />
                </div>
              ))}
              <div className="md:col-span-2 bg-slate-50 border border-slate-100 rounded-lg p-4">
                <div className="text-xs font-bold text-slate-700 mb-2">제품에 등록한 매입가의 기준</div>
                <div className="flex gap-2">
                  {([[true, '부가세 포함가'], [false, '부가세 별도']] as [boolean, string][]).map(([v, label]) => (
                    <button key={String(v)} type="button" onClick={() => setSupplierForm({ ...supplierForm, vatIncluded: v })}
                      className={`flex-1 py-2.5 rounded-lg text-xs font-bold border transition-colors ${supplierForm.vatIncluded === v ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  <b>부가세 포함가</b>: 매입가 10,000원 → 공급가액 9,091 + 부가세 909 = 지급액 10,000원<br/>
                  <b>부가세 별도</b>: 매입가 10,000원 → 공급가액 10,000 + 부가세 1,000 = 지급액 11,000원<br/>
                  기존 데이터와 금액이 달라지지 않도록 기본값은 '부가세 포함가'입니다.
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">메모</label>
                <input className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  value={supplierForm.memo || ''} onChange={e => setSupplierForm({ ...supplierForm, memo: e.target.value })} />
              </div>
              <div className="md:col-span-2 flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsSupplierModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">취소</button>
                <button type="submit" className="px-6 py-2.5 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/20">저장</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <BulkProductImport
        open={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        templates={templates}
        suppliers={suppliers}
        existingProducts={products}
        useSupplierMaster={schema.suppliers}
        remainingSlots={Math.max(0, currentTier.max_products - products.length)}
        onSubmit={handleBulkSubmit}
      />
    </div>
  );
};
