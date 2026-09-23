import React, { useState, useEffect } from 'react';
import { Layers, X } from 'lucide-react';
import { InvoiceTemplate, ProductGroup, Supplier, VatType } from '../types';

/**
 * 제품 그룹 등록·수정 폼.
 *
 * 여기 들어가는 값은 제품 등록 폼의 기본값이 된다. 제품마다 달라지는 값
 * (SKU·제품명·판매가·매입가)은 그룹에 없다 — 그것만 제품에서 입력하면 된다.
 *
 * SupplierFormModal 과 같은 이유로 입력값을 이 컴포넌트 안에서만 들고 있다.
 * 부모 state 에 한 글자씩 쓰면 부모가 다시 그려질 때 입력창이 포커스를 잃는다.
 */

export type ProductGroupForm = Omit<ProductGroup, 'id' | 'user_id'>;

export const BLANK_PRODUCT_GROUP: ProductGroupForm = {
  name: '', templateId: '', supplierId: '', supplierName: '',
  shippingCost: 0, otherCost: 0, marketFeeRate: 0,
  vatType: 'taxable', bundleShipping: false, memo: '',
};

interface Props {
  open: boolean;
  editing: boolean;
  initial: ProductGroupForm;
  /** 중복 검사용. 수정 중인 본인 이름은 빼고 넘긴다 */
  takenNames: string[];
  templates: InvoiceTemplate[];
  suppliers: Supplier[];
  /** suppliers 테이블이 있는지 (없으면 발주처명을 직접 입력) */
  useSupplierMaster: boolean;
  vatSupported: boolean;
  bundleSupported: boolean;
  onClose: () => void;
  onSave: (form: ProductGroupForm) => Promise<void>;
}

export const ProductGroupFormModal: React.FC<Props> = ({
  open, editing, initial, takenNames, templates, suppliers,
  useSupplierMaster, vatSupported, bundleSupported, onClose, onSave,
}) => {
  const [form, setForm] = useState<ProductGroupForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) { setForm(initial); setError(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const set = (patch: Partial<ProductGroupForm>) => setForm(prev => ({ ...prev, ...patch }));

  /** 발주처 마스터를 쓰면 선택한 id 에서 이름을 가져온다 (오타로 업체가 갈라지는 것을 방지) */
  const resolvedSupplierName = useSupplierMaster
    ? (suppliers.find(s => s.id === form.supplierId)?.name || '')
    : String(form.supplierName || '').trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) { setError('그룹명을 입력하세요.'); return; }
    if (takenNames.some(n => n.trim() === name)) { setError(`이미 등록된 그룹 이름입니다: ${name}`); return; }
    if (!form.templateId) { setError('송장 양식을 고르세요.'); return; }
    if (!resolvedSupplierName) { setError('발주처를 고르세요.'); return; }

    setSaving(true);
    try {
      await onSave({
        ...form,
        name,
        supplierName: resolvedSupplierName,
        supplierId: useSupplierMaster ? (form.supplierId || undefined) : undefined,
      });
    } catch (err: any) {
      setError(err?.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in my-8">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Layers size={18} /> {editing ? '제품 그룹 수정' : '제품 그룹 등록'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {error && (
            <div className="md:col-span-2 bg-red-50 border border-red-100 text-red-700 rounded-lg px-3 py-2 text-xs">{error}</div>
          )}

          <div className="md:col-span-2">
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">그룹명 (필수)</label>
            <input autoFocus placeholder="예: 한일식품 - 냉동만두" className={inputCls}
              value={form.name} onChange={e => set({ name: e.target.value })} />
            <p className="text-[10px] text-slate-400 mt-1">제품 등록 화면에서 이 이름으로 고르게 됩니다.</p>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">송장 양식 (필수)</label>
            <select className={`${inputCls} bg-white`} value={form.templateId}
              onChange={e => set({ templateId: e.target.value })}>
              <option value="">송장 양식 선택 *</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <p className="text-[10px] text-slate-400 mt-1">이 그룹의 제품은 전부 이 양식으로 출력됩니다.</p>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">발주처 (필수)</label>
            {useSupplierMaster ? (
              <select className={`${inputCls} bg-white`} value={form.supplierId || ''}
                onChange={e => set({ supplierId: e.target.value })}>
                <option value="">발주처 선택 *</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <input placeholder="예: (주)한일식품" className={inputCls}
                value={form.supplierName || ''} onChange={e => set({ supplierName: e.target.value })} />
            )}
          </div>

          <div className="md:col-span-2 pt-2">
            <h4 className="text-xs font-bold text-slate-700 pb-2 border-b">공통 비용 기본값</h4>
            <p className="text-[10px] text-slate-400 mt-2">
              제품을 등록할 때 이 값들이 미리 채워집니다. 제품별로 다르면 그 자리에서 고쳐도 됩니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">택배비용</label>
              <input type="number" className={inputCls}
                value={form.shippingCost ?? 0} onChange={e => set({ shippingCost: Number(e.target.value) })} />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">기타비용</label>
              <input type="number" className={inputCls}
                value={form.otherCost ?? 0} onChange={e => set({ otherCost: Number(e.target.value) })} />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">마켓 수수료율 (%)</label>
            <div className="relative">
              <input type="number" step="0.1" className={`${inputCls} pr-8`}
                value={form.marketFeeRate ?? 0} onChange={e => set({ marketFeeRate: Number(e.target.value) })} />
              <span className="absolute right-3 top-2.5 text-sm text-slate-400">%</span>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">과세 구분</label>
            <div className="flex gap-2">
              {([['taxable', '과세 (부가세 10%)'], ['exempt', '면세 (부가세 없음)']] as [VatType, string][]).map(([v, label]) => (
                <button key={v} type="button" onClick={() => set({ vatType: v })}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold border transition-colors ${form.vatType === v ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>
            {!vatSupported && (
              <p className="text-[10px] text-amber-600 mt-1">* 마이그레이션 SQL 실행 전이라 제품에는 과세 구분이 저장되지 않습니다.</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="flex items-start gap-2.5 cursor-pointer bg-slate-50 border border-slate-200 rounded-lg p-3">
              <input type="checkbox" checked={form.bundleShipping === true}
                onChange={e => set({ bundleShipping: e.target.checked })}
                className="mt-0.5 rounded border-slate-300" />
              <span className="text-[11px] leading-relaxed text-slate-600">
                <b className="text-slate-800">묶음배송 가능</b><br />
                같은 발주처의 다른 묶음배송 가능 제품과 <b>수취인·주소가 같으면</b> 송장 한 장으로 합칩니다.
                냉동·생선처럼 따로 보내야 하는 그룹은 꺼두세요.
              </span>
            </label>
            {!bundleSupported && (
              <p className="text-[10px] text-amber-600 mt-1">* 마이그레이션 SQL 실행 전이라 제품에는 묶음배송 설정이 저장되지 않습니다.</p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">메모</label>
            <input className={inputCls} value={form.memo || ''} onChange={e => set({ memo: e.target.value })} />
          </div>

          <div className="md:col-span-2 flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">취소</button>
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary-hover transition-all shadow-lg shadow-primary/20 disabled:opacity-50">
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
