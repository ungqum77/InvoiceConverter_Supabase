import React, { useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { ClipboardPaste, FileSpreadsheet, Download, Plus, Trash2, AlertTriangle, Check, X, Wand2 } from 'lucide-react';
import { Product, InvoiceTemplate, Supplier, VatType } from '../types';
import { buildBulkSampleWorkbook, downloadBlob } from '../services/bulkSample';

/**
 * 제품 대량 등록.
 *
 * 예전 방식은 "샘플 엑셀을 받아 → 헤더 이름을 글자까지 똑같이 맞춰 → 업로드 → alert 로
 * 오류 3건만 보고 → 엑셀 다시 열어 수정 → 재업로드" 의 왕복이었다.
 * 이제는 엑셀에서 복사해 붙여넣으면 바로 표로 뜨고, 틀린 칸만 그 자리에서 고쳐 등록한다.
 * 발주처·송장양식은 드롭다운이라 오타 자체가 불가능하다.
 */

// ── 붙여넣은 열이 무엇인지 ──────────────────────────────────────────────────
type FieldKey =
  | 'ignore' | 'sku' | 'name' | 'supplier' | 'template' | 'additionalName' | 'useAlias'
  | 'purchaseCost' | 'salesPrice' | 'shippingCost' | 'otherCost' | 'marketFeeRate' | 'vatType' | 'bundleShipping';

const FIELD_LABELS: { key: FieldKey; label: string }[] = [
  { key: 'ignore',         label: '무시' },
  { key: 'sku',            label: 'SKU' },
  { key: 'name',           label: '제품명' },
  { key: 'additionalName', label: '별칭' },
  { key: 'useAlias',       label: '별칭사용' },
  { key: 'supplier',       label: '발주처' },
  { key: 'template',       label: '송장양식' },
  { key: 'purchaseCost',   label: '매입가' },
  { key: 'salesPrice',     label: '판매가' },
  { key: 'shippingCost',   label: '배송비' },
  { key: 'otherCost',      label: '기타비용' },
  { key: 'marketFeeRate',  label: '수수료율' },
  { key: 'vatType',        label: '과세구분' },
  { key: 'bundleShipping', label: '묶음배송' },
];

// 헤더 자동 인식용. 부분 일치라서 'SKU(필수)', '매입단가' 같은 것도 잡힌다.
// 더 좁은 이름을 먼저 둔다 ('대체제품명사용' 이 '대체제품명' 으로 먼저 잡히면 안 된다)
const ALIASES: { key: FieldKey; words: string[] }[] = [
  { key: 'sku',            words: ['sku', '코드', '품번', '자체상품'] },
  { key: 'useAlias',       words: ['별칭사용', '대체제품명사용', '별칭 사용', '대체명사용'] },
  { key: 'additionalName', words: ['별칭', '대체제품', '추가제품', '대체상품', '대체명'] },
  { key: 'name',           words: ['제품명', '상품명', '품명', '품목명', 'name'] },
  { key: 'supplier',       words: ['발주처', '공급처', '거래처', '공급사', '매입처', '업체'] },
  { key: 'template',       words: ['양식', 'template'] },
  { key: 'purchaseCost',   words: ['매입', '원가', '공급가'] },
  { key: 'salesPrice',     words: ['판매'] },
  { key: 'shippingCost',   words: ['배송', '택배'] },
  { key: 'otherCost',      words: ['기타'] },
  { key: 'marketFeeRate',  words: ['수수료'] },
  { key: 'bundleShipping', words: ['묶음배송', '묶음', '합배송', '합포장'] },
  { key: 'vatType',        words: ['과세', '면세', '부가세'] },
];

const guessField = (header: string): FieldKey => {
  const h = header.trim().toLowerCase();
  if (!h) return 'ignore';
  for (const { key, words } of ALIASES) {
    if (words.some(w => h.includes(w))) return key;
  }
  return 'ignore';
};

// 헤더 없이 붙여넣는 경우가 흔하다. 가장 흔한 순서로 미리 채워둔다.
const POSITIONAL: FieldKey[] = ['sku', 'name', 'supplier', 'purchaseCost', 'salesPrice'];

// ── 표의 한 줄 ──────────────────────────────────────────────────────────────
interface DraftRow {
  key: number;
  sku: string;
  name: string;
  supplier: string;
  templateId: string;
  additionalName: string;   // 별칭 — 발주처 송장에 이 이름으로 찍는다
  useAlias: boolean;
  purchaseCost: string;
  salesPrice: string;
  shippingCost: string;
  otherCost: string;
  marketFeeRate: string;
  vatType: VatType;
  bundleShipping: boolean;
}

const blankRow = (key: number): DraftRow => ({
  key, sku: '', name: '', supplier: '', templateId: '', additionalName: '', useAlias: false,
  purchaseCost: '', salesPrice: '', shippingCost: '', otherCost: '', marketFeeRate: '',
  vatType: 'taxable', bundleShipping: false,
});

/**
 * Y/N 열 해석. 목록에 없으면 전부 N 으로 본다 —
 * 빈 칸도, 알 수 없는 값도 '아니오'가 되어야 실수로 켜지는 일이 없다.
 */
const isYes = (v: string) =>
  ['y', 'yes', '1', 'o', 'true', 'ㅇ', '사용', '예', '가능', '함', 'ok'].includes(v.trim().toLowerCase());

/** 붙여넣은 칸 하나를 해당 필드에 넣는다. 붙여넣기와 열 재지정 양쪽에서 같은 규칙을 쓴다. */
const applyCell = (r: DraftRow, field: FieldKey, v: string, templateByName: Map<string, string>) => {
  switch (field) {
    case 'sku': r.sku = v; break;
    case 'name': r.name = v; break;
    case 'supplier': r.supplier = v; break;
    case 'additionalName': r.additionalName = v; r.useAlias = true; break;
    case 'useAlias': r.useAlias = isYes(v); break;
    case 'template': r.templateId = templateByName.get(v.toLowerCase()) ?? ''; break;
    case 'purchaseCost': r.purchaseCost = v; break;
    case 'salesPrice': r.salesPrice = v; break;
    case 'shippingCost': r.shippingCost = v; break;
    case 'otherCost': r.otherCost = v; break;
    case 'marketFeeRate': r.marketFeeRate = v; break;
    case 'vatType': r.vatType = /면세|면|exempt/i.test(v) ? 'exempt' : 'taxable'; break;
    case 'bundleShipping': r.bundleShipping = isYes(v); break;
  }
};

const buildRows = (body: string[][], cols: FieldKey[], templateByName: Map<string, string>, startKey: number): DraftRow[] =>
  body.map((cells, n) => {
    const r = blankRow(startKey + n);
    cols.forEach((field, i) => {
      const v = (cells[i] ?? '').trim();
      // 별칭사용 열은 값이 비어도 'N' 으로 해석해야 하므로 예외
      if (field === 'ignore' || (!v && field !== 'useAlias' && field !== 'bundleShipping')) return;
      applyCell(r, field, v, templateByName);
    });
    return r;
  });

const toNumber = (v: string): number => {
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const splitRows = (text: string): string[][] => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return [];
  const delim = lines.some(l => l.includes('\t')) ? '\t' : (lines.some(l => l.includes(',')) ? ',' : '\t');
  return lines.map(l => l.split(delim).map(c => c.trim()));
};

interface Props {
  open: boolean;
  onClose: () => void;
  templates: InvoiceTemplate[];
  suppliers: Supplier[];
  existingProducts: Product[];
  useSupplierMaster: boolean;   // suppliers 테이블을 쓰는 스키마인지
  remainingSlots: number;       // 등급 한도까지 남은 제품 수
  bundleSupported: boolean;     // products.bundle_shipping 컬럼이 있는지
  onSubmit: (payload: Omit<Product, 'id' | 'user_id'>[]) => Promise<void>;
}

export const BulkProductImport: React.FC<Props> = ({
  open, onClose, templates, suppliers, existingProducts, useSupplierMaster, remainingSlots, bundleSupported, onSubmit,
}) => {
  const [raw, setRaw] = useState('');
  const [columns, setColumns] = useState<FieldKey[]>([]);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [saving, setSaving] = useState(false);
  const nextKey = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const templateByName = useMemo(
    () => new Map(templates.map(t => [t.name.trim().toLowerCase(), t.id])), [templates]);
  const supplierNames = useMemo(
    () => new Set(suppliers.map(s => s.name.trim().toLowerCase())), [suppliers]);
  const existingSkus = useMemo(
    () => new Set(existingProducts.map(p => p.sku.trim().toLowerCase())), [existingProducts]);

  // ── 2차원 배열 → 표 ───────────────────────────────────────────────────────
  const ingest = (grid: string[][]) => {
    if (grid.length === 0) return;
    const width = Math.max(...grid.map(r => r.length));

    // 첫 줄이 헤더인지 판단: 두 칸 이상이 알려진 이름과 맞으면 헤더로 본다
    const guessed = grid[0].map(guessField);
    const isHeader = guessed.filter(g => g !== 'ignore').length >= 2;

    const cols: FieldKey[] = [];
    for (let i = 0; i < width; i++) {
      cols[i] = isHeader ? (guessed[i] ?? 'ignore') : (POSITIONAL[i] ?? 'ignore');
    }

    const body = isHeader ? grid.slice(1) : grid;
    const next = buildRows(body, cols, templateByName, nextKey.current);
    nextKey.current += next.length;

    setColumns(cols);
    setRows(next);
    setRaw('');
  };

  // 열 지정을 바꾸면 원본을 다시 해석해야 하지만, 이미 손으로 고친 값을 날리면
  // 곤란하다. 그래서 열 지정은 붙여넣기 직후 한 번만 의미가 있고,
  // 그 뒤에는 표에서 직접 고치는 것을 정식 경로로 둔다.
  const [rawGrid, setRawGrid] = useState<string[][]>([]);
  const remapColumn = (index: number, field: FieldKey) => {
    const cols = [...columns];
    cols[index] = field;
    setColumns(cols);
    if (rawGrid.length === 0) return;
    // 원본이 남아 있으면 새 지정으로 전체를 다시 만든다
    const guessed = rawGrid[0].map(guessField);
    const isHeader = guessed.filter(g => g !== 'ignore').length >= 2;
    const body = isHeader ? rawGrid.slice(1) : rawGrid;
    const next = buildRows(body, cols, templateByName, nextKey.current);
    nextKey.current += next.length;
    setRows(next);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text.trim()) return;
    e.preventDefault();
    const grid = splitRows(text);
    setRawGrid(grid);
    ingest(grid);
  };

  const parseTyped = () => {
    const grid = splitRows(raw);
    if (grid.length === 0) return;
    setRawGrid(grid);
    ingest(grid);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        if (!sheet) throw new Error('시트가 없습니다.');
        const grid = (XLSX.utils.sheet_to_json(sheet as any, { header: 1, defval: '', raw: false }) as any[][])
          .map(r => r.map(c => String(c ?? '').trim()))
          .filter(r => r.some(c => c !== ''));
        setRawGrid(grid);
        ingest(grid);
      } catch (err: any) {
        alert('파일을 읽지 못했습니다: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // 송장양식·발주처는 DB에 있는 이름을 두 번째 시트에 깔고 드롭다운으로 고르게 한다.
  const downloadSample = async () => {
    try {
      const blob = await buildBulkSampleWorkbook({
        templateNames: templates.map(t => t.name),
        supplierNames: suppliers.map(s => s.name),
        useSupplierMaster,

      });
      downloadBlob(blob, '제품_대량등록_양식.xlsx');
    } catch (err: any) {
      alert('샘플 파일을 만들지 못했습니다: ' + (err?.message || err));
    }
  };

  // ── 검증 ──────────────────────────────────────────────────────────────────
  const validation = useMemo(() => {
    const seen = new Map<string, number>();
    const errors: (string | null)[] = [];
    let accepted = 0;

    rows.forEach((r, i) => {
      const sku = r.sku.trim().toLowerCase();
      let err: string | null = null;

      if (!r.sku.trim()) err = 'SKU를 입력하세요';
      else if (!r.name.trim()) err = '제품명을 입력하세요';
      else if (!r.supplier.trim()) err = '발주처를 지정하세요';
      else if (useSupplierMaster && !supplierNames.has(r.supplier.trim().toLowerCase()))
        err = '발주처 탭에 없는 이름입니다';
      else if (!r.templateId) err = '송장 양식을 고르세요';
      else if (existingSkus.has(sku)) err = '이미 등록된 SKU입니다';
      else if (seen.has(sku)) err = `${seen.get(sku)! + 1}행과 SKU가 중복입니다`;
      else if (accepted >= remainingSlots) err = '등급 한도를 넘었습니다';

      if (!err) { seen.set(sku, i); accepted++; }
      errors[i] = err;
    });

    return { errors, validCount: accepted };
  }, [rows, existingSkus, supplierNames, templateByName, useSupplierMaster, remainingSlots]);

  const update = (i: number, patch: Partial<DraftRow>) =>
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const applyAll = (patch: Partial<DraftRow>) =>
    setRows(prev => prev.map(r => ({ ...r, ...patch })));

  const submit = async () => {
    const payload: Omit<Product, 'id' | 'user_id'>[] = [];
    rows.forEach((r, i) => {
      if (validation.errors[i]) return;
      const matched = suppliers.find(s => s.name.trim().toLowerCase() === r.supplier.trim().toLowerCase());
      payload.push({
        sku: r.sku.trim(),
        name: r.name.trim(),
        supplierName: matched?.name || r.supplier.trim(),
        supplierId: matched?.id,
        templateId: r.templateId,
        additionalName: r.additionalName.trim() || undefined,
        useAdditionalName: r.useAlias && !!r.additionalName.trim(),
        purchaseCost: toNumber(r.purchaseCost),
        salesPrice: toNumber(r.salesPrice),
        shippingCost: toNumber(r.shippingCost),
        otherCost: toNumber(r.otherCost),
        marketFeeRate: toNumber(r.marketFeeRate),
        vatType: r.vatType,
        bundleShipping: r.bundleShipping,
      });
    });
    if (payload.length === 0) return;
    setSaving(true);
    try {
      await onSubmit(payload);
      reset();
      onClose();
    } catch (err: any) {
      alert('등록 실패: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const reset = () => { setRows([]); setColumns([]); setRawGrid([]); setRaw(''); };
  const close = () => { reset(); onClose(); };

  if (!open) return null;

  const errCount = rows.length - validation.validCount;
  const cell = 'w-full px-1.5 py-1 text-[11px] border border-transparent hover:border-slate-300 focus:border-primary focus:bg-white rounded bg-transparent outline-none';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in">

        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="font-bold flex items-center gap-2 text-slate-800">
            <ClipboardPaste size={18} /> 제품 대량 등록
          </h3>
          <button onClick={close} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        {rows.length === 0 ? (
          /* ── 1단계: 붙여넣기 ──────────────────────────────────────────── */
          <div className="p-6 space-y-4 overflow-y-auto">
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-[12px] text-slate-700 leading-relaxed">
              <p className="font-bold text-slate-800 mb-1">엑셀에서 복사해서 아래에 붙여넣으세요 (Ctrl+V)</p>
              <p>제목 줄이 있어도 되고 없어도 됩니다. 어느 열이 무엇인지는 자동으로 잡고,
                 틀린 곳은 다음 화면의 표에서 바로 고칠 수 있습니다.</p>
              <p className="mt-1.5 text-slate-500">
                엑셀에서 미리 작성하실 거라면 <b>샘플 받기</b>를 쓰세요. 등록해둔
                <b> 송장양식 {templates.length}개</b>{useSupplierMaster && <>· <b>발주처 {suppliers.length}개</b></>}가
                드롭다운으로 들어 있어 이름을 손으로 칠 필요가 없습니다.
              </p>
            </div>

            <textarea
              autoFocus
              value={raw}
              onChange={e => setRaw(e.target.value)}
              onPaste={handlePaste}
              placeholder={'여기에 붙여넣기\n\nA-001\t양파 10kg\t한일식품\t12000\nA-002\t감자 5kg\t한일식품\t8000'}
              className="w-full h-44 rounded-lg border-2 border-dashed border-slate-300 focus:border-primary p-3 text-xs font-mono outline-none resize-none"
            />

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={parseTyped} disabled={!raw.trim()}
                className="px-4 py-2 bg-primary text-white rounded-lg text-xs font-bold disabled:opacity-40">
                입력한 내용으로 표 만들기
              </button>
              <button onClick={() => setRows([blankRow(nextKey.current++)])}
                className="px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200">
                빈 표에서 직접 입력
              </button>
              <div className="flex-1" />
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200">
                <FileSpreadsheet size={14} /> 엑셀 파일로 올리기
              </button>
              <input type="file" accept=".xlsx,.xls,.csv" ref={fileRef} className="hidden" onChange={handleFile} />
              <button onClick={downloadSample} title="등록된 송장양식·발주처가 드롭다운으로 들어간 엑셀을 받습니다"
                className="flex items-center gap-1.5 px-3 py-2 text-slate-500 rounded-lg text-xs font-bold hover:bg-slate-100">
                <Download size={14} /> 샘플 받기 (드롭다운 포함)
              </button>
            </div>
          </div>
        ) : (
          /* ── 2단계: 표에서 확인·수정 ──────────────────────────────────── */
          <>
            <div className="px-6 py-3 border-b bg-white shrink-0 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Wand2 size={13} /> 모든 행에 한 번에 적용</span>
              <select onChange={e => e.target.value && applyAll({ templateId: e.target.value })} value=""
                className="rounded border-slate-300 text-[11px] py-1">
                <option value="">송장 양식 일괄 지정</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {useSupplierMaster && (
                <select onChange={e => e.target.value && applyAll({ supplier: e.target.value })} value=""
                  className="rounded border-slate-300 text-[11px] py-1">
                  <option value="">발주처 일괄 지정</option>
                  {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              )}
              <select onChange={e => e.target.value && applyAll({ vatType: e.target.value as VatType })} value=""
                className="rounded border-slate-300 text-[11px] py-1">
                <option value="">과세구분 일괄 지정</option>
                <option value="taxable">과세</option>
                <option value="exempt">면세</option>
              </select>
              <select onChange={e => e.target.value && applyAll({ bundleShipping: e.target.value === 'Y' })} value=""
                className="rounded border-slate-300 text-[11px] py-1">
                <option value="">묶음배송 일괄 지정</option>
                <option value="Y">묶음배송 가능</option>
                <option value="N">묶음배송 불가</option>
              </select>
              <div className="flex-1" />
              <button onClick={reset} className="text-[11px] text-slate-400 hover:text-slate-600 underline">
                처음부터 다시
              </button>
            </div>

            {columns.length > 0 && (
              <div className="px-6 py-2 bg-slate-50 border-b shrink-0 overflow-x-auto">
                <div className="flex items-center gap-2 text-[10px] text-slate-500 whitespace-nowrap">
                  <span className="font-bold">붙여넣은 열 해석:</span>
                  {columns.map((c, i) => (
                    <select key={i} value={c} onChange={e => remapColumn(i, e.target.value as FieldKey)}
                      className="rounded border-slate-200 text-[10px] py-0.5 bg-white">
                      {FIELD_LABELS.map(f => <option key={f.key} value={f.key}>{i + 1}열 · {f.label}</option>)}
                    </select>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto">
              <table className="w-full text-[11px] border-collapse">
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr className="text-left text-slate-600">
                    <th className="px-2 py-2 w-8"></th>
                    <th className="px-2 py-2 min-w-[110px]">SKU</th>
                    <th className="px-2 py-2 min-w-[150px]">제품명</th>
                    <th className="px-2 py-2 min-w-[150px]">별칭 <span className="font-normal text-slate-400">(송장에 찍힐 이름)</span></th>
                    <th className="px-2 py-2 w-12 text-center">사용</th>
                    <th className="px-2 py-2 min-w-[130px]">발주처</th>
                    <th className="px-2 py-2 min-w-[130px]">송장양식</th>
                    <th className="px-2 py-2 min-w-[90px] text-right">매입가</th>
                    <th className="px-2 py-2 min-w-[90px] text-right">판매가</th>
                    <th className="px-2 py-2 min-w-[80px] text-right">배송비</th>
                    <th className="px-2 py-2 min-w-[80px] text-right">기타비용</th>
                    <th className="px-2 py-2 min-w-[70px] text-right">수수료%</th>
                    <th className="px-2 py-2 min-w-[70px]">과세</th>
                    <th className="px-2 py-2 w-16 text-center">묶음배송</th>
                    <th className="px-2 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const err = validation.errors[i];
                    return (
                      <tr key={r.key} className={`border-b ${err ? 'bg-red-50/60' : 'hover:bg-slate-50'}`}>
                        <td className="px-2 py-1 text-center text-slate-400">
                          {err
                            ? <span title={err}><AlertTriangle size={13} className="text-red-500 inline" /></span>
                            : <Check size={13} className="text-emerald-500 inline" />}
                        </td>
                        <td className="px-1"><input className={cell} value={r.sku} onChange={e => update(i, { sku: e.target.value })} /></td>
                        <td className="px-1"><input className={cell} value={r.name} onChange={e => update(i, { name: e.target.value })} /></td>
                        <td className="px-1">
                          <input className={cell} value={r.additionalName} placeholder="없으면 비워두세요"
                            onChange={e => update(i, { additionalName: e.target.value, useAlias: e.target.value.trim() ? true : r.useAlias })} />
                        </td>
                        <td className="px-1 text-center">
                          <input type="checkbox" checked={r.useAlias} disabled={!r.additionalName.trim()}
                            onChange={e => update(i, { useAlias: e.target.checked })}
                            className="rounded border-slate-300 disabled:opacity-30" />
                        </td>
                        <td className="px-1">
                          {useSupplierMaster ? (
                            <select className={cell} value={r.supplier} onChange={e => update(i, { supplier: e.target.value })}>
                              <option value="">선택</option>
                              {!supplierNames.has(r.supplier.trim().toLowerCase()) && r.supplier &&
                                <option value={r.supplier}>{r.supplier} (미등록)</option>}
                              {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
                          ) : (
                            <input className={cell} value={r.supplier} onChange={e => update(i, { supplier: e.target.value })} />
                          )}
                        </td>
                        <td className="px-1">
                          <select className={cell} value={r.templateId} onChange={e => update(i, { templateId: e.target.value })}>
                            <option value="">선택</option>
                            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        </td>
                        <td className="px-1"><input className={`${cell} text-right`} value={r.purchaseCost} onChange={e => update(i, { purchaseCost: e.target.value })} /></td>
                        <td className="px-1"><input className={`${cell} text-right`} value={r.salesPrice} onChange={e => update(i, { salesPrice: e.target.value })} /></td>
                        <td className="px-1"><input className={`${cell} text-right`} value={r.shippingCost} onChange={e => update(i, { shippingCost: e.target.value })} /></td>
                        <td className="px-1"><input className={`${cell} text-right`} value={r.otherCost} onChange={e => update(i, { otherCost: e.target.value })} /></td>
                        <td className="px-1"><input className={`${cell} text-right`} value={r.marketFeeRate} onChange={e => update(i, { marketFeeRate: e.target.value })} /></td>
                        <td className="px-1">
                          <select className={cell} value={r.vatType} onChange={e => update(i, { vatType: e.target.value as VatType })}>
                            <option value="taxable">과세</option>
                            <option value="exempt">면세</option>
                          </select>
                        </td>
                        <td className="px-1 text-center">
                          <input type="checkbox" checked={r.bundleShipping}
                            onChange={e => update(i, { bundleShipping: e.target.checked })}
                            className="rounded border-slate-300" />
                        </td>
                        <td className="px-2 text-center">
                          <button onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))}
                            className="text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* 빨간 줄의 이유를 표 밖에서도 한눈에 */}
              {errCount > 0 && (
                <div className="m-4 rounded-lg border border-red-100 bg-red-50 p-3 text-[11px] text-red-700 space-y-0.5">
                  <p className="font-bold mb-1">수정이 필요한 {errCount}건</p>
                  {validation.errors.map((e, i) => e && (
                    <p key={i}>{i + 1}행 {rows[i].name || rows[i].sku || '(빈 행)'} — {e}</p>
                  )).filter(Boolean).slice(0, 30)}
                  {errCount > 30 && <p className="text-red-400">…외 {errCount - 30}건</p>}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t bg-slate-50 shrink-0 flex items-center gap-4">
              <button onClick={() => setRows(prev => [...prev, blankRow(nextKey.current++)])}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-primary">
                <Plus size={13} /> 행 추가
              </button>
              <div className="flex-1 text-[11px] text-slate-600">
                <span className="text-emerald-600 font-bold">정상 {validation.validCount}건</span>
                {errCount > 0 && <span className="text-red-500 font-bold ml-2">수정필요 {errCount}건</span>}
                <span className="text-slate-400 ml-2">· 등급 한도 잔여 {remainingSlots}개</span>
                {!bundleSupported && (
                  <span className="text-amber-600 ml-2">· 묶음배송은 마이그레이션 SQL 실행 전이라 아직 저장되지 않습니다</span>
                )}
              </div>
              <button onClick={close} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700">취소</button>
              <button onClick={submit} disabled={validation.validCount === 0 || saving}
                className="px-5 py-2 bg-primary text-white rounded-lg text-xs font-bold disabled:opacity-40">
                {saving ? '등록 중…' : `${validation.validCount}건 등록하기`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
