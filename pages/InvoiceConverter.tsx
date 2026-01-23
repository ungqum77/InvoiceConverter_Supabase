
import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { UploadCloud, FileSpreadsheet, ArrowRight, Download, AlertCircle, CheckCircle2, User, Users, Tag, Loader2, Lock, Youtube, X, ExternalLink } from 'lucide-react';
import { Button } from '../components/Button';
import { fetchProducts, fetchTemplates, fetchAppSettings, AppSettings } from '../services/dbService';
import { InvoiceRow, MatchedOrder, Product, ColumnMapping } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const PRODUCT_NAME_HEADERS = ['상품명', '품목명', '내용물', '물품명', 'Product Name', 'Item Name'];

// Error 153 대응 및 직접 가기 링크가 포함된 가이드 컴포넌트
const YouTubeEmbed = ({ url, title }: { url: string; title: string }) => {
    if (!url) return null;
    
    let videoId = '';
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            videoId = urlObj.pathname.slice(1);
        } else if (urlObj.hostname.includes('youtube.com')) {
            videoId = urlObj.searchParams.get('v') || urlObj.pathname.split('/').pop() || '';
        }
    } catch (e) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        videoId = (match && match[2].length === 11) ? match[2] : '';
    }

    if (!videoId) return null;

    return (
        <div className="mt-8 mb-4 max-w-xl mx-auto bg-slate-900 rounded-xl overflow-hidden shadow-lg border border-slate-700">
             <div className="flex items-center justify-between p-3 bg-slate-800 text-white border-b border-slate-700">
                 <div className="flex items-center gap-2">
                    <Youtube className="text-red-500" size={16}/>
                    <span className="font-bold text-xs">도움말: {title}</span>
                 </div>
                 <a 
                    href={url} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[10px] font-bold transition-colors"
                 >
                    <ExternalLink size={10} /> YouTube에서 보기
                 </a>
             </div>
             <div className="relative pb-[56.25%] h-0 bg-black">
                <iframe
                    className="absolute top-0 left-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                    title={title}
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                ></iframe>
            </div>
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
  const [mapping, setMapping] = useState<ColumnMapping>({ sku: '', orderer: '', receiver: '', option: '' });
  const [matchedData, setMatchedData] = useState<MatchedOrder[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings>({
    silver_subscription_url: '',
    gold_subscription_url: '',
    youtube_tutorial_template: '',
    youtube_tutorial_product: '',
    youtube_tutorial_convert: ''
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if(user) fetchAppSettings().then(setAppSettings); }, [user]);

  // SKU 정규화 헬퍼 함수: 모든 공백 및 보이지 않는 문자 제거, 소문자 변환
  const normalizeSku = (val: any) => {
      return String(val || '').replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
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

      // [V5 Critical Fix]
      // 기존의 sheet_to_json(object 모드) 대신 header: 1 (Array 모드)를 사용하여
      // 엑셀의 컬럼 순서(Index)를 기반으로 데이터를 파싱합니다.
      const data = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' }) as any[][];

      if (data.length > 0) {
        // 1. 헤더 처리 및 고유 키 생성
        const headerRow = data[0];
        const uniqueHeaders: string[] = [];
        const counts: Record<string, number> = {};

        headerRow.forEach((h: any) => {
            let key = (h !== undefined && h !== null) ? String(h).trim() : '';
            if (key === '') key = 'UNKNOWN'; // 빈 헤더 이름 처리

            if (Object.prototype.hasOwnProperty.call(counts, key)) {
                uniqueHeaders.push(`${key}_${counts[key]}`);
                counts[key]++;
            } else {
                uniqueHeaders.push(key);
                counts[key] = 1;
            }
        });

        // 2. 데이터 행 생성 (헤더 인덱스와 1:1 매칭)
        const rows = data.slice(1).map((rowArray) => {
            const rowObj: InvoiceRow = {};
            uniqueHeaders.forEach((header, index) => {
                const val = rowArray[index];
                rowObj[header] = (val !== undefined && val !== null) ? val : '';
            });
            return rowObj;
        });

        // 3. 완전히 비어있는 행 제거
        const validRows = rows.filter(r => Object.values(r).some(v => String(v).trim() !== ''));

        setHeaders(uniqueHeaders);
        setRawRows(validRows);
        setStep(2);
      }
    };
    reader.readAsBinaryString(file);
  };

  const processMatching = async () => {
    if (!mapping.sku || !mapping.orderer || !mapping.receiver) return;
    setIsProcessing(true);
    try {
        const products = await fetchProducts();
        
        // [Logic Update] DB SKU 정규화: 공백/특수문자 모두 제거하여 매칭 확률 극대화
        // P-001 과 P001,  53065 960858 과 53065960858 등을 같게 처리
        const productMap = new Map(products.map(p => [normalizeSku(p.sku), p]));
        
        const results: MatchedOrder[] = rawRows.map((row, idx) => {
            // [Logic Update] 엑셀 SKU 정규화
            const cellValue = normalizeSku(row[mapping.sku]);
            const matchedProduct = productMap.get(cellValue);
            return {
                id: `ROW-${idx}`,
                originalData: row,
                product: matchedProduct,
                status: matchedProduct ? 'matched' : 'unmatched',
                templateId: matchedProduct?.templateId
            };
        });
        setMatchedData(results);
        setStep(3);
    } catch (e) { alert("처리 오류"); } finally { setIsProcessing(false); }
  };

  const downloadExcel = async () => {
    setIsDownloading(true);
    try {
      const templates = await fetchTemplates();
      const templateMap = new Map(templates.map(t => [t.id, t]));
      const zip = new JSZip();
      const col1 = headers[0];
      const col2 = headers[1];

      // 파일명 생성 조건
      const isPlanMode = col1 === '플랜' && col2 === '회차';

      const fileGroups = new Map<string, any>();
      matchedData.forEach(order => {
        if (order.status === 'matched' && order.product?.templateId) {
           let baseName = '';
           if (isPlanMode) {
               baseName = `${String(order.originalData[col1] || 'Unknown')}_${String(order.originalData[col2] || 'Unknown')}_${order.product.supplierName}`;
           } else {
               baseName = order.product.supplierName;
           }

           const safeName = baseName.replace(/[\\/:*?"<>|]/g, '-');
           const key = `${order.product.templateId}:::${safeName}`;
           
           if (!fileGroups.has(key)) fileGroups.set(key, { fileName: safeName, templateId: order.product.templateId, orders: [] });
           fileGroups.get(key).orders.push(order);
        }
      });

      fileGroups.forEach(group => {
         const tpl = templateMap.get(group.templateId);
         if (!tpl) return;
         
         const finalHeaders = (tpl.outputHeaders && tpl.outputHeaders.length > 0) ? tpl.outputHeaders : tpl.headers;

         const dataRows = group.orders.map((o: any) => {
            const rowData: any[] = [];
            const product = o.product!;
            
            // [Logic V4: 제품명 결정 로직 엄격화]
            // 사용자의 요청: "대체 제품명이 있으면 무조건 대체 제품명 사용, 단 설정이 켜져 있을 때만."
            
            // 1. 기본값: DB에 등록된 제품명 (엑셀의 상품명 아님)
            let pName = product.name; 

            // 2. 조건 확인: (대체 이름 사용 설정 ON) AND (대체 이름 값이 존재)
            const canUseAlt = product.useAdditionalName === true;
            const hasAltValue = product.additionalName && String(product.additionalName).trim().length > 0;

            if (canUseAlt && hasAltValue) {
                // 조건 만족 시: 대체 제품명 사용
                pName = String(product.additionalName).trim();
            } else if (mapping.option && o.originalData[mapping.option]) {
                // 3. 대체 제품명을 쓰지 않는 경우에만: 옵션 열이 매핑되어 있고 값이 있으면 사용
                const optVal = String(o.originalData[mapping.option]).trim();
                if (optVal) pName = optVal;
            }

            // 받는 사람/보내는 사람 다를 경우 표기 (유지)
            const ord = String(o.originalData[mapping.orderer] || '').trim();
            const rev = String(o.originalData[mapping.receiver] || '').trim();
            if (ord !== rev) pName += ` 보내는 사람_${ord}`;
            
            tpl.headers.forEach((h: string) => {
               if (PRODUCT_NAME_HEADERS.some(ph => h.includes(ph))) {
                   rowData.push(pName);
               } else {
                   rowData.push(o.originalData[h] || '');
               }
            });
            return rowData;
         });

         const finalSheetData = [finalHeaders, ...dataRows];
         
         const wb = XLSX.utils.book_new();
         const ws = XLSX.utils.aoa_to_sheet(finalSheetData); 
         
         XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
         zip.file(`${group.fileName}.xlsx`, XLSX.write(wb, { bookType: 'xlsx', type: 'array' }));
      });

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a'); a.href = url; a.download = "송장변환.zip"; a.click();
    } catch (e) { alert("다운로드 오류"); } finally { setIsDownloading(false); }
  };

  const [templateNames, setTemplateNames] = useState<Map<string, string>>(new Map());
  useEffect(() => { if(user) fetchTemplates().then(ts => setTemplateNames(new Map(ts.map(t => [t.id, t.name])))); }, [user]);

  const stats = matchedData.reduce((acc, curr) => {
    const name = curr.templateId ? (templateNames.get(curr.templateId) || 'Unknown') : '미확인';
    acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {} as any);
  const chartData = Object.keys(stats).map(name => ({ name, value: stats[name] }));

  if (!user) return <div className="p-20 text-center"><Lock className="mx-auto mb-4" /><Button onClick={() => navigate('/auth')}>로그인 필요</Button></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-screen">
      <div className="mb-8 flex justify-center gap-12 scale-90 sm:scale-100">
        {[1, 2, 3].map(s => <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${step >= s ? 'bg-primary text-white' : 'bg-slate-200 text-slate-400'}`}>{s}</div>)}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl mx-auto">
        {step === 1 && (
          <div className="flex flex-col items-center justify-center text-center py-6 px-6">
            <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-3 text-primary">
              <UploadCloud size={24} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">주문 리스트 업로드</h2>
            <p className="text-slate-500 text-[11px] mb-4 leading-relaxed">
              마켓 엑셀 파일을 업로드하면 발주처별 송장을 자동 생성합니다.
            </p>
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload}/>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} className="px-8">파일 선택</Button>
          </div>
        )}

        {step === 2 && (
          <div className="p-6 space-y-5">
            <div className="p-3 bg-slate-50 rounded-lg border flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <FileSpreadsheet className="text-green-600" size={18} />
                    <span className="text-xs font-medium truncate max-w-[200px]">{fileName} ({rawRows.length}건)</span>
                </div>
                <button onClick={() => setStep(1)} className="text-slate-400 hover:text-red-500 transition-colors"><X size={18}/></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className="block text-[11px] font-bold mb-1 text-slate-700">SKU 열</label><select className="w-full rounded border-slate-300 text-xs py-1.5 focus:ring-primary focus:border-primary" value={mapping.sku} onChange={e => setMapping({...mapping, sku: e.target.value})}><option value="">열 선택</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1 text-slate-700">주문자 열</label><select className="w-full rounded border-slate-300 text-xs py-1.5 focus:ring-primary focus:border-primary" value={mapping.orderer} onChange={e => setMapping({...mapping, orderer: e.target.value})}><option value="">열 선택</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1 text-slate-700">수취인 열</label><select className="w-full rounded border-slate-300 text-xs py-1.5 focus:ring-primary focus:border-primary" value={mapping.receiver} onChange={e => setMapping({...mapping, receiver: e.target.value})}><option value="">열 선택</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
                <div><label className="block text-[11px] font-bold mb-1 text-slate-700">옵션 열 (선택)</label><select className="w-full rounded border-slate-300 text-xs py-1.5 focus:ring-primary focus:border-primary" value={mapping.option} onChange={e => setMapping({...mapping, option: e.target.value})}><option value="">사용 안 함</option>{headers.map(h => <option key={h} value={h}>{h}</option>)}</select></div>
            </div>
            <div className="flex justify-end pt-3 border-t border-slate-100"><Button size="sm" disabled={!mapping.sku || !mapping.orderer} onClick={processMatching}>변환 시작</Button></div>
          </div>
        )}

        {step === 3 && (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 gap-6">
                <div className="flex flex-col justify-center items-center gap-4 bg-slate-50 rounded-xl border p-6 border-dashed border-slate-300">
                    <div className="w-10 h-10 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                        <CheckCircle2 size={20} />
                    </div>
                    <div className="text-center">
                        <p className="text-sm font-bold text-slate-900">데이터 처리 완료</p>
                        <p className="text-[11px] text-slate-500 mt-1">총 {matchedData.filter(d => d.status === 'matched').length}건 / 전체 {matchedData.length}건 변환 성공</p>
                    </div>
                    <Button onClick={downloadExcel} icon={<Download size={16}/>} isLoading={isDownloading}>결과 파일 다운로드</Button>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border h-48">
                    <h4 className="text-[10px] font-bold text-slate-500 mb-2 uppercase">분류 현황</h4>
                    <ResponsiveContainer width="100%" height="80%">
                        <BarChart data={chartData} layout="vertical"><XAxis type="number" hide/><YAxis dataKey="name" type="category" width={60} tick={{fontSize: 9}}/><Bar dataKey="value" fill="#135bec" barSize={15}/></BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="flex justify-start">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)}>처음으로</Button>
            </div>
          </div>
        )}
      </div>

      <YouTubeEmbed url={appSettings.youtube_tutorial_convert} title="송장 변환 가이드" />
    </div>
  );
};
