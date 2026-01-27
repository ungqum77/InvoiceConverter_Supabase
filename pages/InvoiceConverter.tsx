
import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { UploadCloud, FileSpreadsheet, ArrowRight, Download, AlertCircle, CheckCircle2, User, Users, Tag, Loader2, Lock, Youtube, X, ExternalLink, Search, ListFilter, TestTube, DollarSign, Calendar, FolderInput, HardDrive, FolderTree, ChevronRight, Check, FolderOpen } from 'lucide-react';
import { Button } from '../components/Button';
import { fetchProducts, fetchTemplates, fetchAppSettings, AppSettings, saveSalesRecords, deleteOldestSalesRecords, SalesSaveResult } from '../services/dbService';
import { InvoiceRow, MatchedOrder, Product, ColumnMapping, SalesRecord } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const PRODUCT_NAME_HEADERS = ['상품명', '품목명', '내용물', '물품명', '상품이름', '제품명', '제품', 'Product Name', 'Item Name', 'Product', 'Item'];

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
  const [mapping, setMapping] = useState<ColumnMapping>({ sku: '', productName: '', orderer: '', receiver: '', option: '', quantity: '', orderId: '' });
  const [matchedData, setMatchedData] = useState<MatchedOrder[]>([]);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    silver_subscription_url: '', gold_subscription_url: '', youtube_tutorial_template: '', youtube_tutorial_product: '', youtube_tutorial_convert: '',
    price_silver_original: '', price_silver_sale: '', price_gold_original: '', price_gold_sale: '',
  });
  const [financialSummary, setFinancialSummary] = useState<Record<string, number>>({});
  const [saveToCrm, setSaveToCrm] = useState(true);

  // Folder Save Success Modal State
  const [savedFolderInfo, setSavedFolderInfo] = useState<{ name: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { 
      if(user) {
          fetchAppSettings().then(setAppSettings);
          fetchProducts().then(setDbProducts); 
      }
  }, [user]);

  const normalizeSku = (val: any) => String(val || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();

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
        const productMap = new Map<string, Product>(products.map(p => [normalizeSku(p.sku), p]));
        const summary: Record<string, number> = {};
        const results: MatchedOrder[] = rawRows.map((row, idx) => {
            const cellValue = normalizeSku(row[mapping.sku]);
            const matchedProduct = productMap.get(cellValue);
            let qty = 1;
            if (mapping.quantity && row[mapping.quantity]) {
                const q = parseInt(String(row[mapping.quantity]).replace(/[^0-9]/g, ''));
                if (!isNaN(q) && q > 0) qty = q;
            }
            if (matchedProduct) {
                const sup = matchedProduct.supplierName;
                const cost = (matchedProduct.purchaseCost || 0) * qty;
                summary[sup] = (summary[sup] || 0) + cost;
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

  const getProcessingData = async () => {
      const templates = await fetchTemplates();
      const templateMap = new Map(templates.map(t => [t.id, t]));
      const salesRecordsToSave: Omit<SalesRecord, 'id' | 'created_at'>[] = [];
      const fileGroups = new Map<string, { fileName: string; templateId: string; orders: MatchedOrder[]; supplier: string; }>();

      matchedData.forEach(order => {
        const product = order.product;
        if (order.status === 'matched' && product && product.templateId) {
           if (saveToCrm) {
               const qty = order.quantity;
               const salesAmt = (product.salesPrice || 0) * qty;
               const purchAmt = (product.purchaseCost || 0) * qty;
               const shipCost = (product.shippingCost || 0) * qty;
               const fee = Math.round(salesAmt * ((product.marketFeeRate || 0) / 100));
               const profit = salesAmt - purchAmt - shipCost - (product.otherCost || 0) * qty - fee;
               const { name: resolvedName } = getResolvedProductName(order);
               const orderIdValue = mapping.orderId ? String(order.originalData[mapping.orderId] || '').trim() : undefined;

               salesRecordsToSave.push({
                   user_id: user!.id, product_id: product.id, product_name: resolvedName, product_sku: product.sku, supplier_name: product.supplierName,
                   order_id: orderIdValue, quantity: qty, unit_sales_price: product.salesPrice || 0, unit_purchase_cost: product.purchaseCost || 0,
                   total_sales_amount: salesAmt, total_purchase_amount: purchAmt, total_shipping_cost: shipCost, total_market_fee: fee, net_profit: profit, order_date: new Date().toISOString()
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
         const dataRows = group.orders.map((o: any) => {
            const rowData: any[] = [];
            const { name: pName } = getResolvedProductName(o);
            const ord = String(o.originalData[mapping.orderer] || '').trim();
            const rev = String(o.originalData[mapping.receiver] || '').trim();
            let finalName = pName;
            if (o.quantity > 1) finalName += ` (${o.quantity}개)`;
            if (ord !== rev) finalName += ` 보내는 사람_${ord}`;
            tpl.headers.forEach((h: string) => {
               const isProductCol = (mapping.productName && h === mapping.productName) || PRODUCT_NAME_HEADERS.some(ph => h.includes(ph));
               rowData.push(isProductCol ? finalName : o.originalData[h] || '');
            });
            return rowData;
         });
         const wb = XLSX.utils.book_new();
         XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([finalHeaders, ...dataRows]), "Sheet1");
         zip.file(`${datePath}/${group.supplier}/${group.fileName}.xlsx`, XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
      });

      const summaryWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(summaryWb, XLSX.utils.json_to_sheet(Object.entries(financialSummary).map(([sup, amt]) => ({ "발주처": sup, "일일 정산금 (지급액)": amt }))), "정산요약");
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
          const incrementalCosts: Record<string, number> = {};

          const readExcelData = async (dirHandle: any, fileName: string) => {
              try {
                  const fh = await dirHandle.getFileHandle(fileName);
                  const file = await fh.getFile();
                  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
                  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 }) as any[][];
              } catch (e) { return null; }
          };

          for (const [key, group] of fileGroups) {
              const tpl = templateMap.get(group.templateId);
              if (!tpl) continue;
              const supplierDir = await targetDir.getDirectoryHandle(group.supplier, { create: true });
              const fileName = `${group.fileName}.xlsx`;
              const finalHeaders = (tpl.outputHeaders && tpl.outputHeaders.length > 0) ? tpl.outputHeaders : tpl.headers;
              const existingData = await readExcelData(supplierDir, fileName);

              const newRows = group.orders.map(o => {
                  const rowData: any[] = [];
                  const { name: pName } = getResolvedProductName(o);
                  const ord = String(o.originalData[mapping.orderer] || '').trim();
                  const rev = String(o.originalData[mapping.receiver] || '').trim();
                  let finalName = pName;
                  if (o.quantity > 1) finalName += ` (${o.quantity}개)`;
                  if (ord !== rev) finalName += ` 보내는 사람_${ord}`;
                  tpl.headers.forEach(h => {
                     const isPrd = (mapping.productName && h === mapping.productName) || PRODUCT_NAME_HEADERS.some(ph => h.includes(ph));
                     rowData.push(isPrd ? finalName : o.originalData[h] || '');
                  });
                  return { rowData, order: o };
              });

              let finalAoA: any[][] = [];
              let addedCost = 0;

              if (existingData && existingData.length > 0) {
                  const exHeaders = existingData[0] as string[];
                  const getIdx = (colName: string) => exHeaders.findIndex(h => String(h).trim() === String(colName).trim());
                  const idIdx = mapping.orderId ? getIdx(mapping.orderId) : -1;
                  const ordIdx = mapping.orderer ? getIdx(mapping.orderer) : -1;
                  const rcvIdx = mapping.receiver ? getIdx(mapping.receiver) : -1;
                  const prdIdx = exHeaders.findIndex(h => (mapping.productName && h === mapping.productName) || PRODUCT_NAME_HEADERS.some(ph => h.includes(ph)));

                  const existingKeys = new Set(existingData.slice(1).map(r => `${idIdx !== -1 ? r[idIdx] : ''}|${ordIdx !== -1 ? r[ordIdx] : ''}|${rcvIdx !== -1 ? r[rcvIdx] : ''}|${prdIdx !== -1 ? r[prdIdx] : ''}`));
                  
                  finalAoA = [...existingData];
                  newRows.forEach(nr => {
                      const key = `${idIdx !== -1 ? nr.rowData[getIdx(mapping.orderId)] : ''}|${ordIdx !== -1 ? nr.rowData[getIdx(mapping.orderer)] : ''}|${rcvIdx !== -1 ? nr.rowData[getIdx(mapping.receiver)] : ''}|${prdIdx !== -1 ? nr.rowData[prdIdx] : ''}`;
                      if (!existingKeys.has(key)) {
                          finalAoA.push(nr.rowData);
                          if (nr.order.product) addedCost += (nr.order.product.purchaseCost || 0) * nr.order.quantity;
                      }
                  });
              } else {
                  finalAoA = [finalHeaders, ...newRows.map(r => r.rowData)];
                  newRows.forEach(nr => { if (nr.order.product) addedCost += (nr.order.product.purchaseCost || 0) * nr.order.quantity; });
              }

              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(finalAoA), "Sheet1");
              const fh = await supplierDir.getFileHandle(fileName, { create: true });
              const writable = await fh.createWritable();
              await writable.write(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
              await writable.close(); // 여기서 닫아야 'State cached' 에러 방지됨
              incrementalCosts[group.supplier] = (incrementalCosts[group.supplier] || 0) + addedCost;
          }

          const summaryFileName = `00_정산요약_${now.getDate()}.xlsx`;
          const existingSummary = await readExcelData(targetDir, summaryFileName);
          let finalSummaryRows: any[] = [];
          if (existingSummary && existingSummary.length > 0) {
              const summaryMap = new Map<string, number>(existingSummary.slice(1).map(r => [r[0], Number(r[1] || 0)]));
              Object.entries(incrementalCosts).forEach(([sup, amt]) => summaryMap.set(sup, (summaryMap.get(sup) || 0) + amt));
              finalSummaryRows = Array.from(summaryMap.entries()).map(([sup, amt]) => ({ "발주처": sup, "일일 정산금 (지급액)": amt }));
          } else {
              finalSummaryRows = Object.entries(incrementalCosts).map(([sup, amt]) => ({ "발주처": sup, "일일 정산금 (지급액)": amt }));
          }
          const sWb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(sWb, XLSX.utils.json_to_sheet(finalSummaryRows), "정산요약");
          const sfh = await targetDir.getFileHandle(summaryFileName, { create: true });
          const sw = await sfh.createWritable();
          await sw.write(XLSX.write(sWb, { bookType: 'xlsx', type: 'array' }));
          await sw.close();

          await saveCrmDataOnly(salesRecordsToSave);
          
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
                <div className="bg-white rounded-lg border p-4 mb-6 shadow-sm">
                    <h4 className="text-sm font-bold mb-3 flex items-center gap-2"><DollarSign size={16}/> 금일 발주처 정산 요약</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                        {Object.entries(financialSummary).map(([sup, amt]) => (
                            <div key={sup} className="flex justify-between text-xs border-b border-slate-50 pb-1">
                                <span className="text-slate-600">{sup}</span>
                                <span className="font-bold text-red-500">{amt.toLocaleString()} 원</span>
                            </div>
                        ))}
                    </div>
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
