import React, { useState, useEffect } from 'react';
import { Building2, X } from 'lucide-react';
import { Supplier } from '../types';

/**
 * 발주처 등록·수정 폼.
 *
 * 입력값을 이 컴포넌트 안에서만 들고 있는다. 예전에는 부모(ProductManagement)의
 * state 에 한 글자마다 써서, 부모가 다시 그려질 때 입력창이 포커스를 잃는 일이 있었다.
 * 이제 부모는 저장 버튼을 눌렀을 때 결과만 받는다.
 */

export type SupplierForm = Omit<Supplier, 'id' | 'user_id'>;

export const BLANK_SUPPLIER: SupplierForm = {
  name: '', code: '', manager: '', phone: '', email: '', bizNo: '',
  paymentTerms: '', vatIncluded: true, memo: '',
};

const TEXT_FIELDS: [keyof SupplierForm, string, string][] = [
  ['code', '관리 코드', '예: A01'],
  ['manager', '담당자', '예: 김철수'],
  ['phone', '연락처', '예: 010-1234-5678'],
  ['email', '이메일', '예: kim@hanil.co.kr'],
  ['bizNo', '사업자등록번호', '예: 123-45-67890'],
  ['paymentTerms', '결제조건', '예: 월말결산 익월 15일'],
];

interface Props {
  open: boolean;
  editing: boolean;
  initial: SupplierForm;
  /** 중복 검사용. 수정 중인 본인 이름은 빼고 넘긴다 */
  takenNames: string[];
  onClose: () => void;
  onSave: (form: SupplierForm) => Promise<void>;
}

export const SupplierFormModal: React.FC<Props> = ({ open, editing, initial, takenNames, onClose, onSave }) => {
  const [form, setForm] = useState<SupplierForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // 모달이 열릴 때만 초기값을 넣는다. 열려 있는 동안 부모가 다시 그려도 입력값은 그대로다.
  useEffect(() => {
    if (open) { setForm(initial); setError(''); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const set = (patch: Partial<SupplierForm>) => setForm(prev => ({ ...prev, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) { setError('발주처명을 입력하세요.'); return; }
    if (takenNames.some(n => n.trim() === name)) { setError(`이미 등록된 발주처입니다: ${name}`); return; }

    setSaving(true);
    try {
      await onSave({ ...form, name });
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
            <Building2 size={18} /> {editing ? '발주처 수정' : '발주처 등록'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {error && (
            <div className="md:col-span-2 bg-red-50 border border-red-100 text-red-700 rounded-lg px-3 py-2 text-xs">{error}</div>
          )}

          <div className="md:col-span-2">
            <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">발주처명 (필수)</label>
            <input autoFocus placeholder="예: (주)한일식품" className={inputCls}
              value={form.name} onChange={e => set({ name: e.target.value })} />
          </div>

          {TEXT_FIELDS.map(([key, label, ph]) => (
            <div key={String(key)}>
              <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">{label}</label>
              <input placeholder={ph} className={inputCls}
                value={String(form[key] ?? '')}
                onChange={e => set({ [key]: e.target.value } as Partial<SupplierForm>)} />
            </div>
          ))}

          <div className="md:col-span-2 bg-slate-50 border border-slate-100 rounded-lg p-4">
            <div className="text-xs font-bold text-slate-700 mb-2">제품에 등록한 매입가의 기준</div>
            <div className="flex gap-2">
              {([[true, '부가세 포함가'], [false, '부가세 별도']] as [boolean, string][]).map(([v, label]) => (
                <button key={String(v)} type="button" onClick={() => set({ vatIncluded: v })}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold border transition-colors ${form.vatIncluded === v ? 'bg-primary text-white border-primary' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              <b>부가세 포함가</b>: 매입가 10,000원 → 공급가액 9,091 + 부가세 909 = 지급액 10,000원<br />
              <b>부가세 별도</b>: 매입가 10,000원 → 공급가액 10,000 + 부가세 1,000 = 지급액 11,000원<br />
              기존 데이터와 금액이 달라지지 않도록 기본값은 '부가세 포함가'입니다.
            </p>
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
