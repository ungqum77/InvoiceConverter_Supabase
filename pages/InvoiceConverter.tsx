
import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { UploadCloud, FileSpreadsheet, ArrowRight, Download, AlertCircle, CheckCircle2, User, Users, Tag, Loader2, Lock, Youtube, X, ExternalLink, Search, ListFilter, TestTube, DollarSign, Calendar, FolderInput, HardDrive, FolderTree, ChevronRight, Check, FolderOpen } from 'lucide-react';
import { Button } from '../components/Button';
import { fetchProducts, fetchTemplates, fetchAppSettings, AppSettings, saveSalesRecords, deleteOldestSalesRecords, SalesSaveResult, fetchSuppliers, updateTemplate, getSchemaSupport } from '../services/dbService';
import { InvoiceRow, MatchedOrder, Product, ColumnMapping, SalesRecord, Supplier, InvoiceTemplate } from '../types';
import { resolveHeaders, needsReview, toLookup, KIND_LABEL, HeaderResolution, normalizeHeader, normalizeAddress } from '../services/headerMatch';
import { calcProductProfit, AmountBreakdown, emptyBreakdown } from '../services/calc';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const QUANTITY_HEADERS = ['수량', '주문수량', '구매수량', '개수', 'qty', 'quantity'];
const PRODUCT_NAME_HEADERS = ['상품명', '품목명', '내용물', '물품명', '상품이름', '제품명', '제품', 'Product Name', 'Item Name', 'Product', 'Item'];

/** 발주처별 정산 집계 */
interface SupplierSettlement extends AmountBreakdown {
  itemCount: number;
  quantity: number;
  paymentTerms: string;
}

const emptySettlement = (paymentTerms = ''): SupplierSettlement =>
  ({ ...emptyBreakdown(), itemCount: 0, quantity: 0, paymentTerms });

const SUMMARY_COLUMNS = ['발주처', '품목수', '총수량', '공급가액', '부가세', '지급액(부가세포함)', '결제조건'] as const;

type SettlementMap = Record<string, SupplierSettlement>;
const settlementEntries = (m: SettlementMap): [string, SupplierSettlement][] => Object.entries(m);
const settlementTotals = (m: SettlementMap): SupplierSettlement =>
  Object.keys(m).reduce<SupplierSettlement>((acc, k) => ({
    supply: acc.supply + m[k].supply,
    vat: acc.vat + m[k].vat,
    total: acc.total + m[k].total,
    quantity: acc.quantity + m[k].quantity,
    itemCount: acc.itemCount + m[k].itemCount,
    paymentTerms: '',
  }), emptySettlement());

/** 정산요약 시트 행 (엑셀 저장 및 기존 파일 병합에 공통으로 사용) */
const summaryRows = (summary: Record<string, SupplierSettlement>) =>
  Object.entries(summary).map(([name, s]) => ({
    '발주처': name,
    '품목수': s.itemCount,
    '총수량': s.quantity,
    '공급가액': s.supply,
    '부가세': s.vat,
    '지급액(부가세포함)': s.total,
    '결제조건': s.paymentTerms || '',
  }));

const trimAll = (arr: any[]) => arr.map(h => String(h ?? '').trim());
const sameHeaders = (a: any[], b: any[]) => {
  const x = trimAll(a), y = trimAll(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
};

const YouTubeEmbed = ({ url, title }: { url: string; title: string }) => {
    if (!url) return null;
    let videoId = '';
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') videoId = urlObj.pathname.slice(1);
        else if (urlObj.hostname.includes('youtube.com')) videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop() || '';
    } catch (e) { videoId = ''; }
    if (!videoId) return null;
    return (
        <div className="mt-8 mb-4 max-w-xl mx-auto bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-700">
             <div className="flex items-center justify-between p-3 bg-slate-800 text-white border-b border-slate-700">
                 <div className="flex items-center gap-2"><Youtube className="text-red-500" size={16}/><span className="font-bold text-xs">도움말: {title}</span></div>
                 <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold transition-colors"><ExternalLink size={10} /> YouTube에서 보기</a>
             </div>
             <div className="relative pb-[56.25%] h-0 bg-black"><iframe className="absolute top-0 left-0 w-full h-full" src={`https://www.youtube.com/embed/${videoId}?rel=0`} title={title} frameBorder="0" allowFullScreen></iframe></div>
        </div>
    );
};

export const InvoiceConverter: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<InvoiceRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isFolderSaving, setIsFolderSaving] = useState(false);
  const [mapping, setMapping] = useState<ColumnMapping>({ sku: '', productName: '', orderer: '', receiver: '', option: '', quantity: '', orderId: '', address: '' });
  const [matchedData, setMatchedData] = useState<MatchedOrder[]>([]);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    silver_subscription_url: '', gold_subscription_url: '', youtube_tutorial_template: '', youtube_tutorial_product: '', youtube_tutorial_convert: '',
    price_silver_original: '', price_silver_sale: '', price_gold_original: '', price_gold_sale: '',
  });
  const [financialSummary, setFinancialSummary] = useState<Record<string, SupplierSettlement>>({});
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saveToCrm, setSaveToCrm] = useState(true);

  // 양식 열 ↔ 주문서 열 연결
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [aliasSupported, setAliasSupported] = useState(false);
  /** 사용자가 직접 고른 연결. { 양식id: { 양식열이름: 주문서열제목 } } */
  const [manualLinks, setManualLinks] = useState<Record<string, Record<string, string>>>({});
  const [savingAlias, setSavingAlias] = useState(false);

  /** 묶음배송 적용 여부. 제품에 '묶음배송 가능' 표시가 된 것만 대상이다 */
  const [applyBundle, setApplyBundle] = useState(true);

  // Folder Save Success Modal State
  const [savedFolderInfo, setSavedFolderInfo] = useState<{ name: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { 
      if(user) {
          fetchAppSettings().then(setAppSettings);
          fetchProducts().then(setDbProducts);
          fetchSuppliers().then(setSuppliers).catch(() => setSuppliers([]));
          fetchTemplates().then(setTemplates).catch(() => setTemplates([]));
          getSchemaSupport().then(sc => setAliasSupported(sc.templateAliases)).catch(() => {});
      }
  }, [user]);

  const normalizeSku = (val: any) => String(val || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();

  /** \uC81C\uD488\uC774 \uC18D\uD55C \uBC1C\uC8FC\uCC98\uC758 \uC124\uC815(\uBD80\uAC00\uC138 \uD3EC\uD568\uAC00 \uC5EC\uBD80, \uACB0\uC81C\uC870\uAC74)\uC744 \uCC3E\uB294\uB2E4. */
  const supplierOf = (product?: Product): Supplier | undefined => {
    if (!product) return undefined;
    if (product.supplierId) {
      const byId = suppliers.find(s => s.id === product.supplierId);
      if (byId) return byId;
    }
    const name = String(product.supplierName || '').trim();
    return suppliers.find(s => s.name.trim() === name);
  };

  /** \uD55C \uC8FC\uBB38 \uC904\uC758 \uB9E4\uC785 \uAE08\uC561\uC744 \uACF5\uAE09\uAC00\uC561/\uBD80\uAC00\uC138/\uD569\uACC4\uB85C \uACC4\uC0B0 */
  const purchaseOf = (order: MatchedOrder) => {
    const sup = supplierOf(order.product);
    return calcProductProfit(order.product!, order.quantity, sup?.vatIncluded ?? true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as any[][];
      if (data.length > 0) {
        const headerRow = data[0];
        const uniqueHeaders: string[] = [];
        const counts: Record<string, number> = {};
        headerRow.forEach((h: any) => {
            let key = (h !== undefined && h !== null) ? String(h).trim() : '';
            if (key === '') key = 'UNKNOWN';
            if (Object.prototype.hasOwnProperty.call(counts, key)) { uniqueHeaders.push(`${key}_${counts[key]}`); counts[key]++; }
            else { uniqueHeaders.push(key); counts[key] = 1; }
        });
        const rows = data.slice(1).map((rowArray) => {
            const rowObj: InvoiceRow = {};
            uniqueHeaders.forEach((header, index) => { rowObj[header] = rowArray[index] !== undefined ? rowArray[index] : ''; });
            return rowObj;
        });
        const validRows = rows.filter(r => Object.values(r).some(v => String(v).trim() !== ''));

        // === 인공지능 기반 컬럼 자동 매칭 로직 ===
        // 유사어 리스트를 기반으로 가장 적합한 컬럼 헤더를 자동으로 찾아냅니다.
        const findMatch = (hdrs: string[], synonyms: string[]) => {
            const clean = (s: string) => String(s).replace(/[\s_]+/g, '').toLowerCase();
            const synClean = synonyms.map(clean);
            // 1. 정확히 일치하는 단어가 있는지 우선 확인
            for (const h of hdrs) {
                if (synClean.includes(clean(h))) return h;
            }
            // 2. 부분적으로 포함되어 있는지 확인 (ex. "옵션id(필수)" -> "옵션id" 포함)
            for (const h of hdrs) {
                const cleanH = clean(h);
                if (synClean.some(s => cleanH.includes(s) || s.includes(cleanH))) return h;
            }
            return '';
        };

        setMapping({
            sku: findMatch(uniqueHeaders, ['옵션id', '옵션번호', 'sku', '상품코드', '옵션코드', '품목코드', '아이디']),
            productName: findMatch(uniqueHeaders, ['등록상품명', '상품명', '제품명', '등록제품명', '옵션명', '품목명', '물품명', 'productname', 'itemname']),
            orderer: findMatch(uniqueHeaders, ['주문자', '구매자', '주문자명', '구매자명', '주문자이름', '구매자이름', '주문하시는분', '주문인']),
            receiver: findMatch(uniqueHeaders, ['수취인', '받는사람', '수취인명', '수취인성명', '수취인이름', '받으시는분', '수령인', '수령자']),
            orderId: findMatch(uniqueHeaders, ['상품주문번호', '주문번호', '상품오더번호', '오더번호', '결제번호', 'orderno', '주문번호(선택)']),
            quantity: findMatch(uniqueHeaders, ['수량', '구매수', '구매수량', '구매량', '주문수량', 'qty', 'quantity', '주문건수']),
            option: findMatch(uniqueHeaders, ['옵션정보', '선택옵션', '상품옵션', '옵션', '옵션명', '옵션내용']),
            address: findMatch(uniqueHeaders, ['수취인주소', '배송지주소', '수령인주소', '배송주소', '주소', '배송지', 'address'])
        });

        setHeaders(uniqueHeaders);
        setRawRows(validRows);
        setStep(2);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const processMatching = async () => {
    if (!mapping.sku || !mapping.productName || !mapping.orderer || !mapping.receiver) return;
    setIsProcessing(true);
    try {
        const products = dbProducts.length > 0 ? dbProducts : await fetchProducts();
        const supplierList = suppliers.length > 0 ? suppliers : await fetchSuppliers().catch(() => [] as Supplier[]);
        if (supplierList !== suppliers) setSuppliers(supplierList);

        const findSupplier = (p: Product) =>
            (p.supplierId ? supplierList.find(s => s.id === p.supplierId) : undefined)
            || supplierList.find(s => s.name.trim() === String(p.supplierName || '').trim());

        const productMap = new Map<string, Product>(products.map(p => [normalizeSku(p.sku), p]));
        const summary: Record<string, SupplierSettlement> = {};
        const results: MatchedOrder[] = rawRows.map((row, idx) => {
            const cellValue = normalizeSku(row[mapping.sku]);
            const matchedProduct = productMap.get(cellValue);
            let qty = 1;
            if (mapping.quantity && row[mapping.quantity]) {
                const q = parseInt(String(row[mapping.quantity]).replace(/[^0-9]/g, ''));
                if (!isNaN(q) && q > 0) qty = q;
            }
            if (matchedProduct) {
                const supplier = findSupplier(matchedProduct);
                const name = matchedProduct.supplierName;
                const { purchase } = calcProductProfit(matchedProduct, qty, supplier?.vatIncluded ?? true);
                const acc = summary[name] || (summary[name] = emptySettlement(supplier?.paymentTerms || ''));
                acc.supply += purchase.supply;
                acc.vat += purchase.vat;
                acc.total += purchase.total;
                acc.quantity += qty;
                acc.itemCount += 1;
            }
            return { id: `ROW-${idx}`, originalData: row, product: matchedProduct, status: matchedProduct ? 'matched' : 'unmatched', templateId: matchedProduct?.templateId, quantity: qty };
        });
        setMatchedData(results);
        setFinancialSummary(summary);
        setStep(3);
    } catch (e) { alert("처리 오류"); } finally { setIsProcessing(false); }
  };

  const getResolvedProductName = (order: MatchedOrder) => {
    if (order.status !== 'matched' || !order.product) return { name: '', source: 'none' };
    const product = order.product;
    if (product.useAdditionalName === true && product.additionalName) return { name: String(product.additionalName).trim(), source: 'alt_name' };
    if (mapping.option && order.originalData[mapping.option]) return { name: String(order.originalData[mapping.option]).trim(), source: 'option_col' };
    return { name: product.name, source: 'db_name' };
  };

  /** 이번 변환에서 실제로 쓰이는 양식만 추린다 */
  const usedTemplates = useMemo(() => {
    const ids = new Set(matchedData.filter(o => o.status === 'matched' && o.product?.templateId)
      .map(o => o.product!.templateId));
    return templates.filter(t => ids.has(t.id));
  }, [matchedData, templates]);

  /** 양식별 열 연결 결과 */
  const resolutions = useMemo<Record<string, HeaderResolution[]>>(() => {
    const map: Record<string, HeaderResolution[]> = {};
    usedTemplates.forEach(t => {
      map[t.id] = resolveHeaders(t.headers, headers, {
        aliases: t.headerAliases,
        manual: manualLinks[t.id],
      });
    });
    return map;
  }, [usedTemplates, headers, manualLinks]);

  const lookups = useMemo<Record<string, Record<string, string>>>(() => {
    const map: Record<string, Record<string, string>> = {};
    usedTemplates.forEach(t => { map[t.id] = toLookup(resolutions[t.id] ?? []); });
    return map;
  }, [resolutions, usedTemplates]);

  /** 확인이 필요한 연결이 있는 양식들 */
  const reviewNeeded = useMemo(
    () => usedTemplates
      .map(t => ({ tpl: t, items: (resolutions[t.id] ?? []).filter(needsReview) }))
      .filter(x => x.items.length > 0),
    [usedTemplates, resolutions]);

  /** 양식 열 이름으로 주문서 값을 꺼낸다. 연결이 없으면 예전처럼 이름 그대로 시도한다. */
  const cellValue = (order: MatchedOrder, templateId: string, header: string) => {
    const src = lookups[templateId]?.[header];
    if (src === '') return '';
    return order.originalData[src ?? header] ?? '';
  };

  /** 화면에서 고른 연결을 양식의 '다른 이름'으로 저장해 다음부터 자동 적용되게 한다 */
  const saveLinksAsAliases = async () => {
    setSavingAlias(true);
    try {
      let saved = 0;
      for (const tpl of usedTemplates) {
        const picks = manualLinks[tpl.id];
        if (!picks) continue;
        const aliases = tpl.headers.map((h, i) => {
          const list = [...(tpl.headerAliases?.[i] ?? [])];
          const picked = picks[h];
          if (picked && picked !== h && !list.includes(picked)) list.push(picked);
          return list;
        });
        await updateTemplate(tpl.id, {
          name: tpl.name, headers: tpl.headers,
          outputHeaders: tpl.outputHeaders ?? [], headerAliases: aliases,
        });
        saved++;
      }
      if (saved > 0) {
        setTemplates(await fetchTemplates());
        alert('연결을 양식에 저장했습니다. 다음부터는 자동으로 잡힙니다.');
      }
    } catch (e: any) {
      alert('저장 실패: ' + (e?.message || e));
    } finally { setSavingAlias(false); }
  };

  /* ── 묶음배송 ────────────────────────────────────────────────────────────
   * 같은 발주처 · 같은 수취인 · 같은 주소로 가는 주문 중, 제품에 '묶음배송 가능'이
   * 켜진 것끼리만 송장 한 장으로 합친다. 묶음불가 제품은 지금처럼 각각 한 장씩 나간다.
   * 정산요약과 CRM 저장은 합치지 않는다 — 매입가·마진은 제품별로 계산해야 맞다.
   */
  const bundleKeyOf = (o: MatchedOrder) => {
    const rev = normalizeHeader(o.originalData[mapping.receiver]);
    const addr = normalizeAddress(o.originalData[mapping.address]);
    return rev && addr ? `${rev}|${addr}` : '';   // 하나라도 비면 묶지 않는다
  };

  const bundleReady = applyBundle && !!mapping.address;

  /** 이번 변환에서 실제로 몇 건이 몇 장으로 합쳐지는지 */
  const bundlePreview = useMemo(() => {
    if (!mapping.address) return { orders: 0, invoices: 0 };
    const buckets = new Map<string, number>();
    matchedData.forEach(o => {
      if (o.status !== 'matched' || !o.product?.bundleShipping) return;
      const k = bundleKeyOf(o);
      if (!k) return;
      const full = `${o.product.templateId}:::${o.product.supplierName}:::${k}`;
      buckets.set(full, (buckets.get(full) ?? 0) + 1);
    });
    let orders = 0, invoices = 0;
    buckets.forEach(n => { if (n >= 2) { orders += n; invoices += 1; } });
    return { orders, invoices };
  }, [matchedData, mapping.address, mapping.receiver]);

  /**
   * 한 발주처 파일에 들어갈 행들을 만든다.
   * 반환값의 orders 는 그 행에 합쳐진 주문들 (묶이지 않았으면 1건).
   */
  const buildGroupRows = (
    group: { templateId: string; orders: MatchedOrder[] },
    tpl: InvoiceTemplate,
  ): { rowData: any[]; orders: MatchedOrder[] }[] => {
    const isProductCol = (h: string) =>
      (mapping.productName && h === mapping.productName) || PRODUCT_NAME_HEADERS.some(ph => h.includes(ph));
    const isQtyCol = (h: string) => {
      const n = normalizeHeader(h);
      return !!n && QUANTITY_HEADERS.some(q => n === normalizeHeader(q));
    };

    // 묶을 수 있는 것만 골라 수취인+주소로 모은다. 나머지는 순서를 지켜 그대로 둔다.
    const buckets = new Map<string, MatchedOrder[]>();
    const plan: { key: string | null; order: MatchedOrder }[] = [];
    group.orders.forEach(o => {
      const key = bundleReady && o.product?.bundleShipping ? bundleKeyOf(o) : '';
      if (!key) { plan.push({ key: null, order: o }); return; }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(o);
      plan.push({ key, order: o });
    });

    const emitted = new Set<string>();
    const rows: { rowData: any[]; orders: MatchedOrder[] }[] = [];

    const nameOf = (o: MatchedOrder) => getResolvedProductName(o).name;
    const senderSuffix = (orders: MatchedOrder[], rev: string) => {
      const senders = Array.from(new Set(
        orders.map(o => String(o.originalData[mapping.orderer] || '').trim()).filter(v => v && v !== rev),
      ));
      return senders.length > 0 ? ` 보내는 사람_${senders.join('/')}` : '';
    };

    for (const step of plan) {
      const bucket = step.key ? buckets.get(step.key)! : null;

      // 한 건뿐인 묶음은 묶지 않은 것과 똑같이 낸다 (출력이 달라지지 않도록)
      if (!bucket || bucket.length < 2) {
        const o = step.order;
        const rev = String(o.originalData[mapping.receiver] || '').trim();
        let finalName = nameOf(o);
        if (o.quantity > 1) finalName += ` (${o.quantity}개)`;
        finalName += senderSuffix([o], rev);
        const rowData = tpl.headers.map((h: string) =>
          isProductCol(h) ? finalName : cellValue(o, group.templateId, h));
        rows.push({ rowData, orders: [o] });
        continue;
      }

      if (emitted.has(step.key!)) continue;   // 이미 합쳐서 내보낸 묶음
      emitted.add(step.key!);

      const head = bucket[0];
      const rev = String(head.originalData[mapping.receiver] || '').trim();
      // 같은 제품이 여러 줄로 들어오면 수량을 합친다
      const merged = new Map<string, number>();
      bucket.forEach(o => merged.set(nameOf(o), (merged.get(nameOf(o)) ?? 0) + o.quantity));
      let finalName = Array.from(merged.entries()).map(([n, q]) => `${n}(${q})`).join(', ');
      finalName += senderSuffix(bucket, rev);

      const rowData = tpl.headers.map((h: string) => {
        if (isProductCol(h)) return finalName;
        if (isQtyCol(h)) return 1;            // 송장 한 장 = 박스 하나
        return cellValue(head, group.templateId, h);
      });
      rows.push({ rowData, orders: bucket });
    }

    return rows;
  };

  const getProcessingData = async () => {
      const tplList = templates.length > 0 ? templates : await fetchTemplates();
      const templateMap = new Map<string, InvoiceTemplate>(tplList.map(t => [t.id, t]));
      const salesRecordsToSave: Omit<SalesRecord, 'id' | 'created_at'>[] = [];
      const fileGroups = new Map<string, { fileName: string; templateId: string; orders: MatchedOrder[]; supplier: string; }>();

      matchedData.forEach(order => {
        const product = order.product;
        if (order.status === 'matched' && product && product.templateId) {
           if (saveToCrm) {
               const qty = order.quantity;
               // 금액 계산은 services/calc.ts 한 곳에서만 수행한다.
               const calc = purchaseOf(order);
               const { name: resolvedName } = getResolvedProductName(order);
               const orderIdValue = mapping.orderId ? String(order.originalData[mapping.orderId] || '').trim() : undefined;

               salesRecordsToSave.push({
                   user_id: user!.id, product_id: product.id, product_name: resolvedName, product_sku: product.sku,
                   supplier_name: product.supplierName, supplier_id: product.supplierId,
                   order_id: orderIdValue, quantity: qty,
                   unit_sales_price: product.salesPrice || 0, unit_purchase_cost: product.purchaseCost || 0,
                   total_sales_amount: calc.salesAmount,
                   total_purchase_amount: calc.purchase.total,
                   total_supply_amount: calc.purchase.supply,
                   total_vat_amount: calc.purchase.vat,
                   total_shipping_cost: calc.shippingAmount,
                   total_market_fee: calc.marketFee,
                   net_profit: calc.netProfit,
                   order_date: new Date().toISOString()
               });
           }
           const safeName = product.supplierName.replace(/[\\/:*?"<>|]/g, '-');
           const key = `${product.templateId}:::${safeName}`;
           if (!fileGroups.has(key)) fileGroups.set(key, { fileName: safeName, templateId: product.templateId, orders: [], supplier: product.supplierName });
           fileGroups.get(key)?.orders.push(order);
        }
      });
      return { fileGroups, templateMap, salesRecordsToSave };
  };

  const saveCrmDataOnly = async (records: any[]) => {
      if (saveToCrm && records.length > 0) {
          try {
              const result = await saveSalesRecords(records);
              if (!result.success && result.error === 'LIMIT_REACHED' && result.countToDelete) {
                  if (window.confirm(`CRM 데이터 저장 한도를 초과했습니다.\n(초과량: ${result.countToDelete}개)\n오래된 데이터를 자동 삭제하고 저장하시겠습니까?`)) {
                      await deleteOldestSalesRecords(result.countToDelete);
                      const retryResult = await saveSalesRecords(records);
                      if (retryResult.success) alert(`데이터 삭제 후 ${retryResult.savedCount}건이 저장되었습니다.`);
                  }
                  return;
              }
              if (result.success && result.skippedCount > 0) {
                  const preview = result.skippedItems.slice(0, 3).map((i: any) => `[${i.product_name}] 주문번호:${i.order_id}`).join('\n');
                  alert(`[CRM 저장 결과]\n✅ 저장 성공: ${result.savedCount}건\n⚠️ 중복 제외: ${result.skippedCount}건\n\n[중복 제외 항목 예시]\n${preview}\n\n* 주문번호, 발주처, 제품명이 동일한 주문입니다.`);
              }
          } catch (e: any) { alert("CRM 저장 중 오류: " + e.message); }
      }
  };

  const downloadExcel = async () => {
    setIsDownloading(true);
    try {
      const { fileGroups, templateMap, salesRecordsToSave } = await getProcessingData();
      const zip = new JSZip();
      const now = new Date();
      const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}_${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()]}`;

      fileGroups.forEach(group => {
         const tpl = templateMap.get(group.templateId);
         if (!tpl) return;
         const finalHeaders = (tpl.outputHeaders && tpl.outputHeaders.length > 0) ? tpl.outputHeaders : tpl.headers;
         const dataRows = buildGroupRows(group, tpl).map(r => r.rowData);
         const wb = XLSX.utils.book_new();
         XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([finalHeaders, ...dataRows]), "Sheet1");
         zip.file(`${datePath}/${group.supplier}/${group.fileName}.xlsx`, XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
      });

      const summaryWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(summaryWb, XLSX.utils.json_to_sheet(summaryRows(financialSummary)), "정산요약");
      zip.file(`${datePath}/00_정산요약_${now.getDate()}.xlsx`, XLSX.write(summaryWb, { bookType: 'xlsx', type: 'array' }));

      await saveCrmDataOnly(salesRecordsToSave);
      const content = await zip.generateAsync({ type: "blob" });
      const a = document.createElement('a'); a.href = URL.createObjectURL(content); a.download = `송장변환_${now.getFullYear()}${now.getMonth()+1}${now.getDate()}.zip`; a.click();
    } catch (e: any) { alert("다운로드 오류: " + e.message); } finally { setIsDownloading(false); }
  };

  const handleDirectFolderSave = async () => {
      if (!('showDirectoryPicker' in window)) { alert("지원되지 않는 브라우저입니다."); return; }
      setIsFolderSaving(true);
      try {
          const rootHandle = await (window as any).showDirectoryPicker();
          const folderName = rootHandle.name; // 저장된 폴더명 캡처
          const { fileGroups, templateMap, salesRecordsToSave } = await getProcessingData();
          const now = new Date();
          const yearDir = await rootHandle.getDirectoryHandle(String(now.getFullYear()), { create: true });
          const monthDir = await yearDir.getDirectoryHandle(String(now.getMonth() + 1).padStart(2, '0'), { create: true });
          const targetDir = await monthDir.getDirectoryHandle(`${String(now.getDate()).padStart(2, '0')}_${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][now.getDay()]}`, { create: true });
          const incremental: Record<string, SupplierSettlement> = {};
          const renamedFiles: string[] = [];
          const stamp = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;

          const readExcelData = async (dirHandle: any, fileName: string) => {
              try {
                  const fh = await dirHandle.getFileHandle(fileName);
                  const file = await fh.getFile();
                  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
                  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as any[][];
              } catch (e) { return null; }
          };

          for (const [, group] of fileGroups) {
              const tpl = templateMap.get(group.templateId);
              if (!tpl) continue;
              const supplierDir = await targetDir.getDirectoryHandle(group.supplier, { create: true });
              let fileName = `${group.fileName}.xlsx`;
              const finalHeaders = (tpl.outputHeaders && tpl.outputHeaders.length > 0) ? tpl.outputHeaders : tpl.headers;
              const existingData = await readExcelData(supplierDir, fileName);

              // rowData 는 tpl.headers 순서로 만들어지고, 파일에 기록되는 헤더 줄은 finalHeaders 다.
              // 두 배열은 같은 길이의 평행 배열이므로 i번째 값의 '출력 컬럼명'은 finalHeaders[i] 다.
              const newRows = buildGroupRows(group, tpl);

              // [수정] 예전에는 기존 파일의 컬럼 인덱스를 새 행에 그대로 적용해서
              // 양식이 바뀌면 엉뚱한 컬럼끼리 비교되었다. 이제는 '컬럼 이름'으로만 비교한다.
              const tplTrimmed = trimAll(tpl.headers);
              const outputNameFor = (inputHeader?: string) => {
                  if (!inputHeader) return '';
                  const i = tplTrimmed.indexOf(String(inputHeader).trim());
                  return i >= 0 ? String(finalHeaders[i] ?? '').trim() : '';
              };
              const productOutName = (() => {
                  const i = tpl.headers.findIndex(h => (mapping.productName && h === mapping.productName) || PRODUCT_NAME_HEADERS.some(ph => String(h).includes(ph)));
                  return i >= 0 ? String(finalHeaders[i] ?? '').trim() : '';
              })();

              const identityCols = [outputNameFor(mapping.orderId), outputNameFor(mapping.orderer), outputNameFor(mapping.receiver)].filter(Boolean);
              // 주문을 구분할 컬럼이 양식에 하나도 없으면 제품명만으로 비교하게 되어
              // 같은 상품을 주문한 다른 고객이 중복으로 잘못 걸러진다. 이때는 행 전체를 키로 쓴다.
              const keyCols = identityCols.length > 0
                  ? [...identityCols, productOutName].filter(Boolean)
                  : trimAll(finalHeaders);

              const recordOf = (row: any[]) => {
                  const rec: Record<string, any> = {};
                  trimAll(finalHeaders).forEach((h, i) => { rec[h] = row[i]; });
                  return rec;
              };
              const keyOf = (row: any[]) => keyCols.map(c => String(recordOf(row)[c] ?? '').trim()).join('|');

              // 묶음 행이면 합쳐진 주문 전부를 정산에 반영해야 금액이 맞는다
              const accrue = (nr: { orders: MatchedOrder[] }) => {
                  nr.orders.forEach(order => {
                      if (!order.product) return;
                      const { purchase } = purchaseOf(order);
                      const sup = supplierOf(order.product);
                      const acc = incremental[group.supplier] || (incremental[group.supplier] = emptySettlement(sup?.paymentTerms || ''));
                      acc.supply += purchase.supply;
                      acc.vat += purchase.vat;
                      acc.total += purchase.total;
                      acc.quantity += order.quantity;
                      acc.itemCount += 1;
                  });
              };

              let finalAoA: any[][];

              if (existingData && existingData.length > 0 && !sameHeaders(existingData[0], finalHeaders)) {
                  // 기존 파일의 헤더가 현재 양식과 다르다 → 이어붙이면 컬럼이 어긋난다.
                  // 기존 파일은 건드리지 않고 새 파일로 저장한 뒤 사용자에게 알린다.
                  fileName = `${group.fileName}_${stamp}.xlsx`;
                  renamedFiles.push(`${group.supplier}/${group.fileName}.xlsx`);
                  finalAoA = [finalHeaders, ...newRows.map(r => r.rowData)];
                  newRows.forEach(accrue);
              } else if (existingData && existingData.length > 0) {
                  const seen = new Set(existingData.slice(1).map(r => keyOf(r as any[])));
                  finalAoA = [...existingData];
                  newRows.forEach(nr => {
                      const key = keyOf(nr.rowData);
                      if (seen.has(key)) return;
                      seen.add(key);           // 같은 배치 안의 중복도 걸러진다
                      finalAoA.push(nr.rowData);
                      accrue(nr);
                  });
              } else {
                  finalAoA = [finalHeaders, ...newRows.map(r => r.rowData)];
                  newRows.forEach(accrue);
              }

              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(finalAoA), "Sheet1");
              const fh = await supplierDir.getFileHandle(fileName, { create: true });
              const writable = await fh.createWritable();
              await writable.write(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
              await writable.close(); // 여기서 닫아야 'State cached' 에러 방지됨
          }

          let summaryFileName = `00_정산요약_${now.getDate()}.xlsx`;
          const existingSummary = await readExcelData(targetDir, summaryFileName);
          const merged: Record<string, SupplierSettlement> = {};
          Object.entries(incremental).forEach(([sup, s]) => { merged[sup] = { ...s }; });

          if (existingSummary && existingSummary.length > 0) {
              if (sameHeaders(existingSummary[0], SUMMARY_COLUMNS as unknown as any[])) {
                  existingSummary.slice(1).forEach(r => {
                      const name = String(r[0] ?? '').trim();
                      if (!name) return;
                      const acc = merged[name] || (merged[name] = emptySettlement(String(r[6] ?? '')));
                      acc.itemCount += Number(r[1]) || 0;
                      acc.quantity += Number(r[2]) || 0;
                      acc.supply += Number(r[3]) || 0;
                      acc.vat += Number(r[4]) || 0;
                      acc.total += Number(r[5]) || 0;
                      if (!acc.paymentTerms) acc.paymentTerms = String(r[6] ?? '');
                  });
              } else {
                  // 부가세 항목이 없던 예전 형식 → 기존 파일을 덮어쓰지 않고 새 이름으로 저장
                  summaryFileName = `00_정산요약_${now.getDate()}_${stamp}.xlsx`;
                  renamedFiles.push(`00_정산요약_${now.getDate()}.xlsx (예전 형식)`);
              }
          }

          const sWb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(sWb, XLSX.utils.json_to_sheet(summaryRows(merged)), "정산요약");
          const sfh = await targetDir.getFileHandle(summaryFileName, { create: true });
          const sw = await sfh.createWritable();
          await sw.write(XLSX.write(sWb, { bookType: 'xlsx', type: 'array' }));
          await sw.close();

          await saveCrmDataOnly(salesRecordsToSave);

          if (renamedFiles.length > 0) {
              alert(
                  `양식이 바뀐 파일이 있어 기존 파일을 그대로 두고 새 파일로 저장했습니다.\n\n` +
                  renamedFiles.slice(0, 5).join('\n') +
                  (renamedFiles.length > 5 ? `\n...외 ${renamedFiles.length - 5}건` : '') +
                  `\n\n이어붙였다면 컬럼이 어긋났을 수 있어 안전하게 분리했습니다. 두 파일을 확인 후 정리해주세요.`
              );
          }

          // 모달 상태 업데이트 (alert 제거)
          setSavedFolderInfo({ name: folderName });
      } catch (e: any) { if (e.name !== 'AbortError') alert("폴더 저장 오류: " + e.message); } finally { setIsFolderSaving(false); }
  };

  if (!user) return <div className="p-20 text-center"><Lock className="mx-auto mb-4" /><Button onClick={() => navigate('/auth')}>로그인 필요</Button></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 min-h-screen">
      <div className="mb-8 flex justify-center gap-12 scale-90 sm:scale-100">
        {[1, 2, 3].map(s => <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= s ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'}`}>{s}</div>)}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl mx-auto">
        {step === 1 && (
          <div className="flex flex-col items-center justify-center text-center py-6 px-6">
            <UploadCloud size={24} className="text-primary mb-3" />
            <h2 className="text-lg font-bold text-slate-900 mb-1">주문 리스트 업로드</h2>
            <p className="text-slate-500 text-[11px] mb-4">마켓 엑셀 파일을 업로드하면 발주처별 송장을 자동 생성합니다.</p>
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload}/>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} className="px-8">파일 선택</Button>
          </div>
        )}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <div className="p-3 bg-slate-50 rounded-lg border flex justify-between items-center">
                <div className="flex items-center gap-2"><FileSpreadsheet className="text-green-600" size={18} /><span className="text-xs font-medium truncate max-w-[200px]">{fileName} ({rawRows.length}건)</span></div>
                <button onClick={() => setStep(1)} className="text-slate-400 hover:text-red-500"><X size={18}/></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="block text-[11px] font-bold mb-1">SKU 열 (필수)</label><select className="w-full rounded border-slate-300 text-xs py-1.5" value={mapping.sku} onChange={e => setMapping({...mapping, sku: e.target.value})}><option value="">선택</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1 text-primary">제품명 열 (필수)</label><select className="w-full rounded border-primary bg-blue-50/50 text-xs py-1.5" value={mapping.productName} onChange={e => setMapping({...mapping, productName: e.target.value})}><option value="">선택</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1">주문자 열 (필수)</label><select className="w-full rounded border-slate-300 text-xs py-1.5" value={mapping.orderer} onChange={e => setMapping({...mapping, orderer: e.target.value})}><option value="">선택</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1">수취인 열 (필수)</label><select className="w-full rounded border-slate-300 text-xs py-1.5" value={mapping.receiver} onChange={e => setMapping({...mapping, receiver: e.target.value})}><option value="">선택</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1 text-slate-500">주문번호 열 (선택-중복방지)</label><select className="w-full rounded border-slate-300 text-xs py-1.5" value={mapping.orderId} onChange={e => setMapping({...mapping, orderId: e.target.value})}><option value="">안함</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1 text-slate-500">수량 열 (선택)</label><select className="w-full rounded border-slate-300 text-xs py-1.5" value={mapping.quantity} onChange={e => setMapping({...mapping, quantity: e.target.value})}><option value="">1개로 가정</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1 text-slate-500">주소 열 (선택-묶음배송)</label><select className="w-full rounded border-slate-300 text-xs py-1.5" value={mapping.address} onChange={e => setMapping({...mapping, address: e.target.value})}><option value="">안함</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1 text-slate-500">옵션 열 (선택)</label><select className="w-full rounded border-slate-300 text-xs py-1.5" value={mapping.option} onChange={e => setMapping({...mapping, option: e.target.value})}><option value="">안함</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
            </div>
            <div className="flex justify-end pt-3 border-t"><Button size="sm" disabled={!mapping.sku || !mapping.productName || !mapping.orderer || !mapping.receiver} onClick={processMatching}>변환 시작</Button></div>
          </div>
        )}
        {step === 3 && (
          <div className="p-6 space-y-6">
            <div className="bg-slate-50 rounded-xl border p-6 border-slate-200">
                <div className="flex flex-col items-center text-center mb-6">
                    <CheckCircle2 size={24} className="text-green-600 mb-2" />
                    <h3 className="text-lg font-bold">변환 완료</h3>
                    <p className="text-xs text-slate-500">총 {matchedData.filter(d => d.status === 'matched').length}건 변환 성공</p>
                </div>
                {bundlePreview.orders > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={applyBundle} onChange={e => setApplyBundle(e.target.checked)}
                        className="mt-0.5 rounded border-slate-300" />
                      <span className="text-[11px] leading-relaxed text-slate-700">
                        <b className="text-slate-900">묶음배송으로 합치기</b> —
                        같은 발주처 · 같은 수취인 · 같은 주소로 가는 주문
                        <b className="text-blue-700"> {bundlePreview.orders}건</b>을
                        송장 <b className="text-blue-700">{bundlePreview.invoices}장</b>으로 합칩니다.<br />
                        품목 칸에 <span className="font-mono bg-white px-1 rounded border">고추(1), 살코기(2)</span> 처럼 적히고 수량은 1로 나갑니다.
                        제품에 <b>묶음배송 가능</b>을 켜둔 것만 대상입니다.
                        정산 금액과 CRM 기록은 제품별로 따로 계산되니 합쳐도 달라지지 않습니다.
                      </span>
                    </label>
                  </div>
                )}
                {!mapping.address && matchedData.some(o => o.product?.bundleShipping) && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-6 text-[11px] text-slate-500">
                    묶음배송 가능 제품이 있지만 <b>주소 열</b>을 지정하지 않아 합치지 않았습니다.
                    합치시려면 이전 단계에서 주소 열을 골라주세요.
                  </div>
                )}

                {reviewNeeded.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                    <h4 className="text-sm font-bold text-amber-900 mb-1 flex items-center gap-2">
                      <AlertCircle size={16} /> 확인이 필요한 열이 있습니다
                    </h4>
                    <p className="text-[11px] text-amber-800 leading-relaxed mb-3">
                      양식의 열 이름과 주문서의 열 제목이 정확히 같지 않습니다. 아래에서 확인하거나 직접 골라주세요.
                      그냥 두면 <b>추측</b>한 열로 채우고, <b>연결 안 됨</b>은 빈칸으로 나갑니다.
                    </p>
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {reviewNeeded.map(({ tpl, items }) => (
                        <div key={tpl.id} className="bg-white rounded border border-amber-100 p-3">
                          <div className="text-[11px] font-bold text-slate-700 mb-2">{tpl.name}</div>
                          <div className="space-y-1.5">
                            {items.map(r => (
                              <div key={r.header} className="flex items-center gap-2 text-[11px]">
                                <span className="w-24 shrink-0 truncate text-slate-600" title={r.header}>{r.header}</span>
                                <span className="text-slate-300">&rarr;</span>
                                <select
                                  className="flex-1 rounded border-slate-300 text-[11px] py-1"
                                  value={r.orderHeader}
                                  onChange={e => setManualLinks(prev => ({
                                    ...prev,
                                    [tpl.id]: { ...(prev[tpl.id] ?? {}), [r.header]: e.target.value },
                                  }))}>
                                  <option value="">연결 안 함 (빈칸)</option>
                                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                </select>
                                <span className={r.kind === 'none' ? 'shrink-0 w-20 text-right text-red-500' : 'shrink-0 w-20 text-right text-amber-600'}>
                                  {KIND_LABEL[r.kind]}{r.kind === 'similar' ? ` ${Math.round(r.score * 100)}%` : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    {aliasSupported && Object.keys(manualLinks).length > 0 && (
                      <button onClick={saveLinksAsAliases} disabled={savingAlias}
                        className="mt-3 w-full py-2 bg-white border border-amber-300 text-amber-800 rounded-lg text-[11px] font-bold hover:bg-amber-100 disabled:opacity-50">
                        {savingAlias ? '저장 중…' : '이 연결을 양식에 기억시키기 (다음부터 자동)'}
                      </button>
                    )}
                  </div>
                )}

                <div className="bg-white rounded-lg border p-4 mb-6 shadow-sm">
                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><DollarSign size={16}/> 금일 발주처 정산 요약</h4>
                    <div className="overflow-x-auto max-h-52 overflow-y-auto">
                        <table className="w-full text-xs">
                            <thead className="text-[10px] text-slate-400 uppercase tracking-wider border-b">
                                <tr>
                                    <th className="text-left font-bold py-1.5">발주처</th>
                                    <th className="text-right font-bold py-1.5">수량</th>
                                    <th className="text-right font-bold py-1.5">공급가액</th>
                                    <th className="text-right font-bold py-1.5">부가세</th>
                                    <th className="text-right font-bold py-1.5 text-red-500">지급액</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {settlementEntries(financialSummary).map(([sup, s]) => (
                                    <tr key={sup}>
                                        <td className="py-1.5 text-slate-600 pr-2">{sup}</td>
                                        <td className="py-1.5 text-right font-mono text-slate-400">{s.quantity.toLocaleString()}</td>
                                        <td className="py-1.5 text-right font-mono text-slate-500">{s.supply.toLocaleString()}</td>
                                        <td className="py-1.5 text-right font-mono text-slate-400">{s.vat.toLocaleString()}</td>
                                        <td className="py-1.5 text-right font-mono font-bold text-red-500">{s.total.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-slate-200">
                                <tr>
                                    <td className="py-2 font-bold text-slate-700">합계</td>
                                    <td className="py-2 text-right font-mono text-slate-500">
                                        {settlementTotals(financialSummary).quantity.toLocaleString()}
                                    </td>
                                    <td className="py-2 text-right font-mono text-slate-600">
                                        {settlementTotals(financialSummary).supply.toLocaleString()}
                                    </td>
                                    <td className="py-2 text-right font-mono text-slate-500">
                                        {settlementTotals(financialSummary).vat.toLocaleString()}
                                    </td>
                                    <td className="py-2 text-right font-mono font-black text-red-600">
                                        {settlementTotals(financialSummary).total.toLocaleString()} 원
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">
                        * 매입가가 부가세 포함가인지 여부는 발주처 설정을 따릅니다. 면세 품목은 부가세가 0원으로 계산됩니다.
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-lg mb-4">
                    <input type="checkbox" id="saveCrm" checked={saveToCrm} onChange={e => setSaveToCrm(e.target.checked)} className="rounded text-primary"/>
                    <label htmlFor="saveCrm" className="text-xs font-bold text-blue-800 cursor-pointer">매출 내역을 CRM(통계)에 저장하기</label>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                        <Button onClick={downloadExcel} icon={<Download size={16}/>} variant="secondary" isLoading={isDownloading} className="w-full">ZIP 다운로드</Button>
                        <p className="text-[10px] text-slate-400 text-center">다운로드 후 '폴더 열기' 가능</p>
                    </div>
                    <div className="space-y-2">
                        <Button onClick={handleDirectFolderSave} icon={<HardDrive size={16}/>} isLoading={isFolderSaving} className="w-full bg-indigo-600 text-white">폴더 자동 저장 (중복 방지)</Button>
                        <p className="text-[10px] text-slate-400 text-center">지정된 폴더에 즉시 저장 (폴더 열기 불가)</p>
                    </div>
                </div>
            </div>
            <div className="flex justify-center"><Button variant="ghost" size="sm" onClick={() => setStep(1)}>처음으로</Button></div>
          </div>
        )}
      </div>

      {/* 저장 완료 모달 (커스텀) */}
      {savedFolderInfo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl m-4 transform scale-100 transition-transform">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-3">
                        <Check className="text-green-600 w-8 h-8" strokeWidth={3} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900">저장 완료!</h3>
                    <p className="text-xs text-slate-500 mt-1">파일이 안전하게 저장되었습니다.</p>
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 mb-4">
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <FolderOpen size={14} /> 저장된 폴더명
                    </div>
                    <div className="flex items-center gap-2">
                        <code className="flex-1 bg-white border border-slate-200 px-3 py-2.5 rounded-lg text-sm font-bold text-slate-800 break-all shadow-sm">
                            {savedFolderInfo.name}
                        </code>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                        * 보안상 전체 경로는 표시되지 않습니다.<br/>
                        * 파일 탐색기에서 해당 폴더를 확인해주세요.
                    </p>
                </div>

                <Button className="w-full" onClick={() => setSavedFolderInfo(null)}>
                    확인
                </Button>
            </div>
        </div>
      )}

      <YouTubeEmbed url={appSettings.youtube_tutorial_convert} title="송장 변환 가이드" />
    </div>
  );
};
