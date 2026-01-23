
import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { UploadCloud, FileSpreadsheet, ArrowRight, Download, AlertCircle, CheckCircle2, User, Users, Tag, Loader2, Lock, Youtube, X, ExternalLink, Search, ListFilter, TestTube, DollarSign, Calendar, FolderInput, HardDrive, FolderTree, ChevronRight } from 'lucide-react';
import { Button } from '../components/Button';
import { fetchProducts, fetchTemplates, fetchAppSettings, AppSettings, saveSalesRecords } from '../services/dbService';
import { InvoiceRow, MatchedOrder, Product, ColumnMapping, SalesRecord } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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
  
  const [mapping, setMapping] = useState<ColumnMapping>({ sku: '', productName: '', orderer: '', receiver: '', option: '', quantity: '' });
  
  const [matchedData, setMatchedData] = useState<MatchedOrder[]>([]);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    silver_subscription_url: '', gold_subscription_url: '', youtube_tutorial_template: '', youtube_tutorial_product: '', youtube_tutorial_convert: ''
  });
  
  // Financial Summary
  const [financialSummary, setFinancialSummary] = useState<Record<string, number>>({});
  const [saveToCrm, setSaveToCrm] = useState(true);

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
            uniqueHeaders.forEach((header, index) => {
                const val = rowArray[index];
                rowObj[header] = (val !== undefined && val !== null) ? val : '';
            });
            return rowObj;
        });

        const validRows = rows.filter(r => Object.values(r).some(v => String(v).trim() !== ''));
        setHeaders(uniqueHeaders);
        setRawRows(validRows);
        setStep(2);
      }
    };
    reader.readAsBinaryString(file);
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
            
            // Quantity Parse
            let qty = 1;
            if (mapping.quantity && row[mapping.quantity]) {
                const q = parseInt(String(row[mapping.quantity]).replace(/[^0-9]/g, ''));
                if (!isNaN(q) && q > 0) qty = q;
            }

            // Financial Summary Calculation
            if (matchedProduct) {
                const sup = matchedProduct.supplierName;
                const cost = (matchedProduct.purchaseCost || 0) * qty;
                summary[sup] = (summary[sup] || 0) + cost;
            }

            return {
                id: `ROW-${idx}`,
                originalData: row,
                product: matchedProduct,
                status: matchedProduct ? 'matched' : 'unmatched',
                templateId: matchedProduct?.templateId,
                quantity: qty
            };
        });
        setMatchedData(results);
        setFinancialSummary(summary);
        setStep(3);
    } catch (e) { alert("처리 오류"); } finally { setIsProcessing(false); }
  };

  const getResolvedProductName = (order: MatchedOrder) => {
    if (order.status !== 'matched' || !order.product) return { name: '', source: 'none' };
    const product = order.product;
    const canUseAlt = product.useAdditionalName === true;
    const hasAltValue = product.additionalName && String(product.additionalName).trim().length > 0;

    if (canUseAlt && hasAltValue) { return { name: String(product.additionalName).trim(), source: 'alt_name' }; } 
    else if (mapping.option && order.originalData[mapping.option]) {
        const optVal = String(order.originalData[mapping.option]).trim();
        if (optVal) return { name: optVal, source: 'option_col' };
    }
    return { name: product.name, source: 'db_name' };
  };

  const getProcessingData = async () => {
      const templates = await fetchTemplates();
      const templateMap = new Map(templates.map(t => [t.id, t]));
      
      const col1 = headers[0];
      const col2 = headers[1];
      const isPlanMode = col1 === '플랜' && col2 === '회차';

      interface FileGroup { fileName: string; templateId: string; orders: MatchedOrder[]; supplier: string; }
      const fileGroups = new Map<string, FileGroup>();
      const salesRecordsToSave: Omit<SalesRecord, 'id' | 'created_at'>[] = [];

      matchedData.forEach(order => {
        const product = order.product as Product | undefined;
        if (order.status === 'matched' && product && product.templateId) {
           // CRM Data
           if (saveToCrm) {
               const qty = order.quantity;
               const salesAmt = (product.salesPrice || 0) * qty;
               const purchAmt = (product.purchaseCost || 0) * qty;
               const shipCost = (product.shippingCost || 0) * qty;
               const fee = Math.round(salesAmt * ((product.marketFeeRate || 0) / 100));
               const profit = salesAmt - purchAmt - shipCost - (product.otherCost || 0) * qty - fee;
               
               // Resolve product name (Use Alt Name or Option Name if applicable)
               const { name: resolvedName } = getResolvedProductName(order);

               salesRecordsToSave.push({
                   user_id: user!.id,
                   product_id: product.id,
                   product_name: resolvedName, // Save the actual name used on invoice
                   product_sku: product.sku,
                   supplier_name: product.supplierName,
                   quantity: qty,
                   unit_sales_price: product.salesPrice || 0,
                   unit_purchase_cost: product.purchaseCost || 0,
                   total_sales_amount: salesAmt,
                   total_purchase_amount: purchAmt,
                   total_shipping_cost: shipCost,
                   total_market_fee: fee,
                   net_profit: profit,
                   order_date: new Date().toISOString()
               });
           }

           // File Grouping
           let baseName = '';
           if (isPlanMode) baseName = `${String(order.originalData[col1] || 'Unknown')}_${String(order.originalData[col2] || 'Unknown')}_${product.supplierName}`;
           else baseName = product.supplierName;

           const safeName = baseName.replace(/[\\/:*?"<>|]/g, '-');
           const key = `${product.templateId}:::${safeName}`;
           
           if (!fileGroups.has(key)) {
             fileGroups.set(key, { fileName: safeName, templateId: product.templateId, orders: [], supplier: product.supplierName });
           }
           fileGroups.get(key)?.orders.push(order);
        }
      });
      return { fileGroups, templateMap, salesRecordsToSave };
  };

  const saveCrmDataOnly = async (records: any[]) => {
      if (saveToCrm && records.length > 0) {
          await saveSalesRecords(records);
          console.log("CRM Data Saved");
      }
  };

  // --- 1. ZIP DOWNLOAD (Fallback) ---
  const downloadExcel = async () => {
    setIsDownloading(true);
    try {
      const { fileGroups, templateMap, salesRecordsToSave } = await getProcessingData();
      const zip = new JSZip();

      // Folder Structure Generation
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const date = String(now.getDate()).padStart(2, '0');
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayName = days[now.getDay()];
      
      const folderPath = `${year}/${month}/${date}_${dayName}`;

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
               const isUserSelectedProductCol = mapping.productName && h === mapping.productName;
               const isAutoDetectedProductCol = PRODUCT_NAME_HEADERS.some(ph => h.includes(ph));
               if (isUserSelectedProductCol || isAutoDetectedProductCol) rowData.push(finalName);
               else rowData.push(o.originalData[h] || '');
            });
            return rowData;
         });

         const finalSheetData = [finalHeaders, ...dataRows];
         const wb = XLSX.utils.book_new();
         const ws = XLSX.utils.aoa_to_sheet(finalSheetData); 
         XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
         
         const fullPath = `${folderPath}/${group.supplier}/${group.fileName}.xlsx`;
         zip.file(fullPath, XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
      });

      // Add Settlement Summary
      const summaryData = Object.entries(financialSummary).map(([sup, amt]) => ({ "발주처": sup, "일일 정산금 (지급액)": amt }));
      const summaryWs = XLSX.utils.json_to_sheet(summaryData);
      const summaryWb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(summaryWb, summaryWs, "정산요약");
      zip.file(`${folderPath}/00_정산요약_${date}.xlsx`, XLSX.write(summaryWb, { bookType: 'xlsx', type: 'array' }));

      // Save CRM
      await saveCrmDataOnly(salesRecordsToSave);

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a'); a.href = url; a.download = `송장변환_${year}${month}${date}.zip`; a.click();
    } catch (e: any) { alert("다운로드/저장 오류: " + e.message); } finally { setIsDownloading(false); }
  };

  // --- 2. DIRECT FOLDER SAVE (File System Access API) ---
  const handleDirectFolderSave = async () => {
      // Feature Check
      if (!('showDirectoryPicker' in window)) {
          alert("이 브라우저는 폴더 직접 저장을 지원하지 않습니다. (Chrome, Edge, Opera 지원)\n'ZIP 다운로드' 기능을 이용해주세요.");
          return;
      }

      setIsFolderSaving(true);
      try {
          // 1. User picks Root Folder
          const rootHandle = await (window as any).showDirectoryPicker();
          if (!rootHandle) return;

          const { fileGroups, templateMap, salesRecordsToSave } = await getProcessingData();

          // 2. Date Structure
          const now = new Date();
          const year = String(now.getFullYear());
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const date = String(now.getDate()).padStart(2, '0');
          const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const dayName = days[now.getDay()];
          const dateDirName = `${date}_${dayName}`;

          // Create Directories: Root -> Year -> Month -> Date
          const yearDir = await rootHandle.getDirectoryHandle(year, { create: true });
          const monthDir = await yearDir.getDirectoryHandle(month, { create: true });
          const targetDir = await monthDir.getDirectoryHandle(dateDirName, { create: true });

          // Helper: Write with versioning if file exists
          const writeExcelWithVersioning = async (dirHandle: any, baseName: string, content: any) => {
             let fileName = `${baseName}.xlsx`;
             let counter = 1;
             
             // Check if file exists and increment version
             while (true) {
                 try {
                     await dirHandle.getFileHandle(fileName); // Throws if not found
                     // File exists, create new name
                     fileName = `${baseName}_version_${String(counter).padStart(2, '0')}.xlsx`;
                     counter++;
                 } catch (e) {
                     // File not found, safe to use this name
                     break;
                 }
             }

             const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
             const writable = await fileHandle.createWritable();
             await writable.write(content);
             await writable.close();
          };

          // 3. Write Excel Files (Invoice Files)
          for (const [key, group] of fileGroups) {
              const tpl = templateMap.get(group.templateId);
              if (!tpl) continue;
              
              const supplierDir = await targetDir.getDirectoryHandle(group.supplier, { create: true });

              // Build Excel
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
                   const isUserSelectedProductCol = mapping.productName && h === mapping.productName;
                   const isAutoDetectedProductCol = PRODUCT_NAME_HEADERS.some(ph => h.includes(ph));
                   if (isUserSelectedProductCol || isAutoDetectedProductCol) rowData.push(finalName);
                   else rowData.push(o.originalData[h] || '');
                });
                return rowData;
              });

              const finalSheetData = [finalHeaders, ...dataRows];
              const wb = XLSX.utils.book_new();
              const ws = XLSX.utils.aoa_to_sheet(finalSheetData); 
              XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
              const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
              
              // Use versioning logic
              await writeExcelWithVersioning(supplierDir, group.fileName, excelBuffer);
          }

          // 4. Write or Append Summary
          const summaryFileName = `00_정산요약_${date}.xlsx`;
          const newSummaryRows = Object.entries(financialSummary).map(([sup, amt]) => ({ "발주처": sup, "일일 정산금 (지급액)": amt }));
          
          let finalSummaryData = newSummaryRows;
          
          try {
              // Try to read existing summary
              const existingHandle = await targetDir.getFileHandle(summaryFileName);
              const file = await existingHandle.getFile();
              const arrayBuffer = await file.arrayBuffer();
              const wb = XLSX.read(arrayBuffer, { type: 'array' });
              const ws = wb.Sheets[wb.SheetNames[0]];
              const existingData = XLSX.utils.sheet_to_json(ws);
              
              // Append new rows to existing data
              finalSummaryData = [...existingData, ...newSummaryRows] as any[];
          } catch (e) {
              // File doesn't exist, use new data only
          }

          const summaryWs = XLSX.utils.json_to_sheet(finalSummaryData);
          const summaryWb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(summaryWb, summaryWs, "정산요약");
          const summaryBuffer = XLSX.write(summaryWb, { bookType: 'xlsx', type: 'array' });
          
          // Write (Overwrite/Create) the summary file
          const summaryFileHandle = await targetDir.getFileHandle(summaryFileName, { create: true });
          const summaryWritable = await summaryFileHandle.createWritable();
          await summaryWritable.write(summaryBuffer);
          await summaryWritable.close();

          // 5. Save CRM
          await saveCrmDataOnly(salesRecordsToSave);

          alert("저장이 완료되었습니다! 선택하신 폴더를 확인해주세요.");

      } catch (e: any) {
          if (e.name !== 'AbortError') { // User cancelled picker
              alert("폴더 저장 중 오류 발생: " + e.message);
          }
      } finally {
          setIsFolderSaving(false);
      }
  };
  
  // -- Helper to get preview structure --
  const getPreviewStructure = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = days[now.getDay()];
    return `${year} > ${month} > ${date}_${dayName} > [발주처명]`;
  };

  const handleDebugSearch = () => { /* ... */ }; 

  if (!user) return <div className="p-20 text-center"><Lock className="mx-auto mb-4" /><Button onClick={() => navigate('/auth')}>로그인 필요</Button></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
      <div className="mb-8 flex justify-center gap-12 scale-90 sm:scale-100">
        {[1, 2, 3].map(s => <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= s ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'}`}>{s}</div>)}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl mx-auto">
        {step === 1 && (
          <div className="flex flex-col items-center justify-center text-center py-6 px-6">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 text-primary"><UploadCloud size={24} /></div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">주문 리스트 업로드</h2>
            <p className="text-slate-500 text-[11px] mb-4 leading-relaxed">마켓 엑셀 파일을 업로드하면 발주처별 송장을 자동 생성합니다.</p>
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload}/>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} className="px-8">파일 선택</Button>
          </div>
        )}

        {step === 2 && (
          <div className="p-6 space-y-5">
            <div className="p-3 bg-slate-50 rounded-lg border flex justify-between items-center">
                <div className="flex items-center gap-2"><FileSpreadsheet className="text-green-600" size={18} /><span className="text-xs font-medium truncate max-w-[200px]">{fileName} ({rawRows.length}건)</span></div>
                <button onClick={() => setStep(1)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={18}/></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="block text-[11px] font-bold mb-1 text-slate-700">SKU 열 (필수)</label><select className="w-full rounded border-slate-300 text-xs py-1.5 focus:ring-primary focus:border-primary" value={mapping.sku} onChange={e => setMapping({...mapping, sku: e.target.value})}><option value="">열 선택</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1 text-primary">제품명 열 (필수)</label><select className="w-full rounded border-slate-300 text-xs py-1.5 focus:ring-primary focus:border-primary border-primary bg-blue-50/50" value={mapping.productName} onChange={e => setMapping({...mapping, productName: e.target.value})}><option value="">열 선택</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1 text-slate-700">주문자 열 (필수)</label><select className="w-full rounded border-slate-300 text-xs py-1.5 focus:ring-primary focus:border-primary" value={mapping.orderer} onChange={e => setMapping({...mapping, orderer: e.target.value})}><option value="">열 선택</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1 text-slate-700">수취인 열 (필수)</label><select className="w-full rounded border-slate-300 text-xs py-1.5 focus:ring-primary focus:border-primary" value={mapping.receiver} onChange={e => setMapping({...mapping, receiver: e.target.value})}><option value="">열 선택</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                
                {/* Optional Columns */}
                <div><label className="block text-[11px] font-bold mb-1 text-slate-500">수량 열 (선택 - 정산 정확도 향상)</label><select className="w-full rounded border-slate-300 text-xs py-1.5 focus:ring-primary focus:border-primary" value={mapping.quantity} onChange={e => setMapping({...mapping, quantity: e.target.value})}><option value="">1개로 가정</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1 text-slate-500">옵션 열 (선택 - 옵션명 대체용)</label><select className="w-full rounded border-slate-300 text-xs py-1.5 focus:ring-primary focus:border-primary" value={mapping.option} onChange={e => setMapping({...mapping, option: e.target.value})}><option value="">사용 안 함</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
            </div>
            <div className="flex justify-end pt-3 border-t border-slate-100"><Button size="sm" disabled={!mapping.sku || !mapping.productName || !mapping.orderer || !mapping.receiver} onClick={processMatching}>변환 시작</Button></div>
          </div>
        )}

        {step === 3 && (
          <div className="p-6 space-y-6">
            <div className="bg-slate-50 rounded-xl border p-6 border-slate-200">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-2"><CheckCircle2 size={24} /></div>
                    <h3 className="text-lg font-bold text-slate-900">변환 완료</h3>
                    <p className="text-xs text-slate-500">총 {matchedData.filter(d => d.status === 'matched').length}건 변환 성공</p>
                </div>

                {/* Settlement Message */}
                <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6 shadow-sm">
                    <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><DollarSign size={16}/> 금일 발주처 정산 요약</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {Object.keys(financialSummary).length > 0 ? Object.entries(financialSummary).map(([sup, amt]) => (
                            <div key={sup} className="flex justify-between text-xs border-b border-slate-50 pb-1 last:border-0">
                                <span className="text-slate-600">{sup}</span>
                                <span className="font-bold text-red-500">{amt.toLocaleString()} 원 지급 필요</span>
                            </div>
                        )) : <div className="text-xs text-slate-400">정산 데이터 없음 (매입가 미설정 등)</div>}
                    </div>
                </div>

                <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg mb-4">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="saveCrm" checked={saveToCrm} onChange={e => setSaveToCrm(e.target.checked)} className="rounded text-primary focus:ring-primary"/>
                        <label htmlFor="saveCrm" className="text-xs font-bold text-blue-800 cursor-pointer">매출 내역을 CRM(통계)에 저장하기</label>
                    </div>
                </div>

                {/* Visual Preview of Folder Structure */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-4 text-xs text-slate-600">
                    <div className="flex items-center gap-1 font-bold mb-2 text-indigo-600">
                        <FolderTree size={14}/> 폴더 자동 생성 구조 미리보기
                    </div>
                    <div className="flex items-center gap-1.5 bg-white p-2 rounded border border-slate-100 text-slate-500">
                        <FolderInput size={14} className="text-slate-400"/>
                        <span className="font-bold text-slate-800">[선택한 폴더]</span>
                        <ChevronRight size={12} />
                        <span>{new Date().getFullYear()}</span>
                        <ChevronRight size={12} />
                        <span>{String(new Date().getMonth()+1).padStart(2,'0')}</span>
                        <ChevronRight size={12} />
                        <span>{String(new Date().getDate()).padStart(2,'0')}_{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()]}</span>
                        <ChevronRight size={12} />
                        <span className="italic text-slate-400">발주처명...</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Button onClick={downloadExcel} icon={<Download size={16}/>} variant="secondary" isLoading={isDownloading} className="w-full">
                        ZIP 다운로드
                    </Button>
                    <Button onClick={handleDirectFolderSave} icon={<HardDrive size={16}/>} isLoading={isFolderSaving} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white border-transparent">
                        폴더 선택 및 자동 저장
                    </Button>
                </div>
                <p className="text-[10px] text-center text-slate-400 mt-2">* '폴더 자동 저장'은 Chrome, Edge 브라우저에서 지원됩니다.</p>
            </div>
            
            <div className="flex justify-center">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>처음으로 돌아가기</Button>
            </div>
          </div>
        )}
      </div>
      <YouTubeEmbed url={appSettings.youtube_tutorial_convert} title="송장 변환 가이드" />
    </div>
  );
};
