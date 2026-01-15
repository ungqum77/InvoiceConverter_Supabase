import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, ArrowRight, Download, CheckCircle2, ShieldAlert, Merge, RefreshCw, X } from 'lucide-react';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export const InvoiceMatcher: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // File 1: 원본 주문서 (Target)
  const [originalFile, setOriginalFile] = useState<{name: string, data: any[], headers: string[]} | null>(null);
  // File 2: 송장 파일 (Source)
  const [courierFile, setCourierFile] = useState<{name: string, data: any[], headers: string[]} | null>(null);

  // Mapping Configuration
  const [mapping, setMapping] = useState({
    originalOrderCol: '', // 원본의 주문번호 열
    courierOrderCol: '',  // 송장파일의 주문번호 열
    courierNameCol: '',   // 송장파일의 택배사 열
    trackingNumCol: ''    // 송장파일의 운송장번호 열
  });

  const originalInputRef = useRef<HTMLInputElement>(null);
  const courierInputRef = useRef<HTMLInputElement>(null);

  // 관리자 권한 체크
  if (!user || !isAdmin) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
            <ShieldAlert size={48} className="text-red-500 mb-4"/>
            <h2 className="text-2xl font-bold text-slate-900">접근 권한이 없습니다</h2>
            <p className="text-slate-500 mb-6">이 페이지는 관리자 전용입니다.</p>
            <Button onClick={() => navigate('/')}>홈으로 돌아가기</Button>
        </div>
    );
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'original' | 'courier') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (typeof bstr !== 'string') return;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      if (data.length > 0) {
        const headers = data[0].map(h => String(h));
        const rows = XLSX.utils.sheet_to_json(ws);
        if (type === 'original') {
            setOriginalFile({ name: file.name, data: rows, headers });
        } else {
            setCourierFile({ name: file.name, data: rows, headers });
        }
      }
    };
    reader.readAsBinaryString(file);
    // 같은 파일 다시 선택 가능하도록 초기화
    e.target.value = '';
  };

  const processMerge = () => {
    if (!originalFile || !courierFile) return;
    if (!mapping.originalOrderCol || !mapping.courierOrderCol || !mapping.courierNameCol || !mapping.trackingNumCol) {
        alert("모든 열 매핑을 선택해주세요.");
        return;
    }

    setIsProcessing(true);
    try {
        // 1. 송장 정보를 Map으로 생성 (Key: 주문번호, Value: {택배사, 운송장})
        const courierMap = new Map<string, { name: string, tracking: string }>();
        courierFile.data.forEach((row: any) => {
            const key = String(row[mapping.courierOrderCol] || '').trim();
            if (key) {
                courierMap.set(key, {
                    name: String(row[mapping.courierNameCol] || ''),
                    tracking: String(row[mapping.trackingNumCol] || '')
                });
            }
        });

        // 2. 원본 데이터 순회하며 정보 병합
        let matchCount = 0;
        const mergedData = originalFile.data.map((row: any) => {
            const key = String(row[mapping.originalOrderCol] || '').trim();
            const match = courierMap.get(key);
            
            if (match) {
                matchCount++;
                return {
                    ...row,
                    '택배사': match.name,
                    '운송장번호': match.tracking
                };
            }
            return row;
        });

        // 3. 엑셀 생성 및 다운로드
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(mergedData);
        XLSX.utils.book_append_sheet(wb, ws, "배송정보입력완료");
        XLSX.writeFile(wb, `[배송입력]_${originalFile.name}`);

        alert(`총 ${mergedData.length}건 중 ${matchCount}건의 배송 정보가 입력되었습니다.`);
        setStep(2); // 완료 상태로 이동 (필요시)
    } catch (e: any) {
        alert("처리 중 오류 발생: " + e.message);
    } finally {
        setIsProcessing(false);
    }
  };

  const reset = () => {
      setStep(1);
      setOriginalFile(null);
      setCourierFile(null);
      setMapping({ originalOrderCol: '', courierOrderCol: '', courierNameCol: '', trackingNumCol: '' });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8 flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                <Merge size={24} />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-slate-900">배송 정보 매칭 (Admin)</h1>
                <p className="text-sm text-slate-500">원본 주문서에 택배사/송장번호를 자동으로 입력합니다.</p>
            </div>
        </div>

        {step === 1 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* 왼쪽: 파일 업로드 영역 */}
                <div className="space-y-6">
                    {/* 원본 파일 업로드 */}
                    <div className={`p-6 border-2 border-dashed rounded-xl transition-all ${originalFile ? 'border-green-300 bg-green-50' : 'border-slate-300 hover:border-primary bg-white'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold uppercase text-slate-500">Step 1. 원본 주문서 (입력 대상)</span>
                            {originalFile && <button onClick={() => setOriginalFile(null)}><X size={16} className="text-slate-400 hover:text-red-500"/></button>}
                        </div>
                        {originalFile ? (
                            <div className="flex items-center gap-3 text-green-700 font-bold">
                                <FileSpreadsheet size={24}/>
                                <span className="truncate">{originalFile.name}</span>
                            </div>
                        ) : (
                            <div className="text-center py-4 cursor-pointer" onClick={() => originalInputRef.current?.click()}>
                                <Upload size={32} className="mx-auto text-slate-300 mb-2"/>
                                <p className="text-sm font-bold text-slate-600">원본 엑셀 파일 업로드</p>
                                <input type="file" accept=".xlsx, .xls" className="hidden" ref={originalInputRef} onChange={(e) => handleFileUpload(e, 'original')}/>
                            </div>
                        )}
                    </div>

                    {/* 송장 파일 업로드 */}
                    <div className={`p-6 border-2 border-dashed rounded-xl transition-all ${courierFile ? 'border-blue-300 bg-blue-50' : 'border-slate-300 hover:border-primary bg-white'}`}>
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold uppercase text-slate-500">Step 2. 송장 파일 (정보 출처)</span>
                            {courierFile && <button onClick={() => setCourierFile(null)}><X size={16} className="text-slate-400 hover:text-red-500"/></button>}
                        </div>
                        {courierFile ? (
                            <div className="flex items-center gap-3 text-blue-700 font-bold">
                                <FileSpreadsheet size={24}/>
                                <span className="truncate">{courierFile.name}</span>
                            </div>
                        ) : (
                            <div className="text-center py-4 cursor-pointer" onClick={() => courierInputRef.current?.click()}>
                                <Upload size={32} className="mx-auto text-slate-300 mb-2"/>
                                <p className="text-sm font-bold text-slate-600">송장 엑셀 파일 업로드</p>
                                <input type="file" accept=".xlsx, .xls" className="hidden" ref={courierInputRef} onChange={(e) => handleFileUpload(e, 'courier')}/>
                            </div>
                        )}
                    </div>
                </div>

                {/* 오른쪽: 매핑 및 실행 영역 */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-fit">
                    <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2"><CheckCircle2 size={18} className="text-primary"/> 열 매핑 설정</h3>
                    
                    <div className="space-y-4 mb-8">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                원본 주문서의 '공통 값<span className="text-indigo-600 ml-1">(예시 상품발주번호)</span>' 열
                            </label>
                            <select 
                                className="w-full text-sm border-slate-200 rounded-lg p-2.5 focus:ring-primary focus:border-primary disabled:bg-slate-100"
                                value={mapping.originalOrderCol}
                                onChange={(e) => setMapping({...mapping, originalOrderCol: e.target.value})}
                                disabled={!originalFile}
                            >
                                <option value="">파일을 먼저 업로드하세요</option>
                                {originalFile?.headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>

                        <div className="border-t border-slate-100 my-4"></div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">송장 파일의 '주문번호' 열 (비교용)</label>
                            <select 
                                className="w-full text-sm border-slate-200 rounded-lg p-2.5 focus:ring-primary focus:border-primary disabled:bg-slate-100"
                                value={mapping.courierOrderCol}
                                onChange={(e) => setMapping({...mapping, courierOrderCol: e.target.value})}
                                disabled={!courierFile}
                            >
                                <option value="">파일을 먼저 업로드하세요</option>
                                {courierFile?.headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">송장 파일의 '택배사명' 열 (가져올 값 1)</label>
                            <select 
                                className="w-full text-sm border-slate-200 rounded-lg p-2.5 focus:ring-primary focus:border-primary disabled:bg-slate-100"
                                value={mapping.courierNameCol}
                                onChange={(e) => setMapping({...mapping, courierNameCol: e.target.value})}
                                disabled={!courierFile}
                            >
                                <option value="">파일을 먼저 업로드하세요</option>
                                {courierFile?.headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">송장 파일의 '운송장번호' 열 (가져올 값 2)</label>
                            <select 
                                className="w-full text-sm border-slate-200 rounded-lg p-2.5 focus:ring-primary focus:border-primary disabled:bg-slate-100"
                                value={mapping.trackingNumCol}
                                onChange={(e) => setMapping({...mapping, trackingNumCol: e.target.value})}
                                disabled={!courierFile}
                            >
                                <option value="">파일을 먼저 업로드하세요</option>
                                {courierFile?.headers.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                    </div>

                    <Button 
                        onClick={processMerge} 
                        className="w-full py-3" 
                        isLoading={isProcessing}
                        disabled={!originalFile || !courierFile}
                        icon={<Merge size={18} />}
                    >
                        정보 병합 및 다운로드
                    </Button>
                </div>
            </div>
        )}

        {step === 2 && (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-xl border border-slate-200 shadow-sm text-center">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 size={32} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">작업 완료!</h2>
                <p className="text-slate-500 mb-8">원본 엑셀 파일에 택배사 및 운송장 번호가 성공적으로 입력되었습니다.<br/>다운로드가 자동으로 시작되지 않으면 다시 시도해주세요.</p>
                <Button variant="secondary" onClick={reset} icon={<RefreshCw size={16}/>}>
                    다른 파일 작업하기
                </Button>
            </div>
        )}
    </div>
  );
};