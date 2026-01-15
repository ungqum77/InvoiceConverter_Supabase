import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileSpreadsheet, CheckCircle2, ShieldAlert, Merge, RefreshCw, X } from 'lucide-react';
import { Button } from '../components/Button';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

export const InvoiceMatcher: React.FC = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [isProcessing, setIsProcessing] = useState(false);

  // File 1: 원본 주문서 (Target) - 구조 유지를 위해 2차원 배열(AoA)로 저장
  const [originalFile, setOriginalFile] = useState<{name: string, data: any[][], headers: string[]} | null>(null);
  
  // File 2: 송장 파일 (Source) - 데이터 조회를 위해 객체 배열로 저장
  const [courierFile, setCourierFile] = useState<{name: string, data: any[], headers: string[]} | null>(null);

  // Mapping Configuration
  const [mapping, setMapping] = useState({
    originalOrderCol: '', // 원본의 주문번호 열 헤더명
    courierOrderCol: '',  // 송장파일의 주문번호 열 헤더명
    courierNameCol: '',   // 송장파일의 택배사 열 헤더명
    trackingNumCol: ''    // 송장파일의 운송장번호 열 헤더명
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

      if (type === 'original') {
        // 원본 파일: 구조 유지를 위해 header: 1 (Array of Arrays) 옵션 사용
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (data.length > 0) {
            // 첫 번째 행을 헤더로 간주
            const headers = data[0].map(h => String(h));
            setOriginalFile({ name: file.name, data, headers });
        }
      } else {
        // 송장 파일: 데이터 조회가 목적이므로 객체(JSON) 형태로 변환 + 헤더 추출
        const dataAoA = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        if (dataAoA.length > 0) {
            const headers = dataAoA[0].map(h => String(h));
            // 실제 데이터는 객체 형태로 다시 파싱 (조회 편의성)
            const dataObjs = XLSX.utils.sheet_to_json(ws);
            setCourierFile({ name: file.name, data: dataObjs, headers });
        }
      }
    };
    reader.readAsBinaryString(file);
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
        // 1. 송장 정보를 Map으로 생성 (빠른 검색용)
        const courierMap = new Map<string, { name: string, tracking: string }>();
        courierFile.data.forEach((row: any) => {
            // 비교 키: 공백 제거 및 문자열 변환
            const key = String(row[mapping.courierOrderCol] || '').trim();
            if (key) {
                courierMap.set(key, {
                    name: String(row[mapping.courierNameCol] || ''),
                    tracking: String(row[mapping.trackingNumCol] || '')
                });
            }
        });

        // 2. 원본 데이터 수정 (In-place update)
        // 복사본 생성 (React State 불변성 유지보다는 성능 및 로직 단순화를 위해 데이터 복제)
        const updatedData = [...originalFile.data]; 
        const headerRow = updatedData[0]; // 헤더 행

        // 2-1. 원본에서 '키' 컬럼 인덱스 찾기
        const keyColIndex = headerRow.findIndex(h => String(h) === mapping.originalOrderCol);
        
        if (keyColIndex === -1) throw new Error("원본 파일에서 선택한 주문번호 열을 찾을 수 없습니다.");

        // 2-2. '택배사', '운송장번호' 컬럼 인덱스 찾기 (없으면 추가)
        let courierColIndex = headerRow.findIndex(h => String(h).includes('택배사'));
        let trackingColIndex = headerRow.findIndex(h => String(h).includes('운송장') || String(h).includes('송장번호'));

        // 헤더가 없으면 맨 뒤에 추가
        if (courierColIndex === -1) {
            courierColIndex = headerRow.length;
            updatedData[0][courierColIndex] = '택배사';
        }
        if (trackingColIndex === -1) {
            trackingColIndex = headerRow.length; 
            // 만약 택배사를 방금 추가했다면 그 다음 열이 됨
            if (trackingColIndex === courierColIndex) trackingColIndex++; 
            updatedData[0][trackingColIndex] = '운송장번호';
        }

        // 3. 데이터 순회하며 매칭 및 업데이트
        let matchCount = 0;
        // 헤더(0번 인덱스) 제외하고 1번부터 시작
        for (let i = 1; i < updatedData.length; i++) {
            const row = updatedData[i];
            const key = String(row[keyColIndex] || '').trim();
            
            if (key && courierMap.has(key)) {
                const match = courierMap.get(key)!;
                // 해당 인덱스에 값 업데이트 (배열 크기가 작으면 자동 확장됨)
                row[courierColIndex] = match.name;
                row[trackingColIndex] = match.tracking;
                matchCount++;
            }
        }

        // 4. 엑셀 생성 및 다운로드 (원본 파일명 그대로 사용)
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(updatedData);
        XLSX.utils.book_append_sheet(wb, ws, "배송정보입력완료");
        
        // 다운로드 실행
        XLSX.writeFile(wb, originalFile.name);

        alert(`총 ${updatedData.length - 1}건 중 ${matchCount}건의 배송 정보가 입력되었습니다.`);
        setStep(2);
    } catch (e: any) {
        alert("처리 중 오류 발생: " + e.message);
        console.error(e);
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
                <p className="text-sm text-slate-500">원본 주문서 파일에 택배사 및 송장번호를 채워넣습니다.</p>
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
                                <p className="text-[10px] text-slate-400 mt-1">* 이 파일에 정보가 입력되어 다시 다운로드됩니다.</p>
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
                        정보 업데이트 및 다운로드
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
                <p className="text-slate-500 mb-8">
                    원본 엑셀 파일({originalFile?.name})에 배송 정보가 업데이트되어 다운로드되었습니다.<br/>
                    <span className="text-xs text-slate-400">브라우저 다운로드 폴더를 확인해주세요.</span>
                </p>
                <Button variant="secondary" onClick={reset} icon={<RefreshCw size={16}/>}>
                    다른 파일 작업하기
                </Button>
            </div>
        )}
    </div>
  );
};