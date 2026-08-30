import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, X, Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle, Info } from 'lucide-react';
import { InvoiceTemplate } from '../types';

/**
 * 송장 양식 편집.
 *
 * 열 이름 변경 · 순서 변경 · 추가 · 삭제를 화면에서 한다.
 * 엑셀을 다시 만들어 올리고 기존 양식을 지우는 왕복을 없애기 위한 것.
 *
 * 열은 두 벌이다.
 *   매칭용(1행) — 주문서에서 값을 꺼낼 때 쓰는 이름. 주문서 열 제목과 같아야 한다
 *   출력용(2행) — 발주처에 보낼 파일에 찍히는 이름. 비우면 매칭용을 그대로 쓴다
 *
 * 입력값은 이 컴포넌트 안에서만 들고 있다가 저장할 때 한 번 넘긴다.
 */

interface Column {
  key: number;
  match: string;   // 1행
  output: string;  // 2행
  alias: string;   // 쉼표로 구분한 다른 이름들
}

interface Props {
  open: boolean;
  template: InvoiceTemplate | null;
  /** 이름 중복 검사용. 자기 자신은 빼고 넘긴다 */
  takenNames: string[];
  onClose: () => void;
  onSave: (name: string, headers: string[], outputHeaders: string[], aliases: string[][]) => Promise<void>;
  /** header_aliases 컬럼이 없는 DB 면 별칭 입력을 숨긴다 */
  aliasSupported: boolean;
}

export const TemplateEditModal: React.FC<Props> = ({ open, template, takenNames, onClose, onSave, aliasSupported }) => {
  const [name, setName] = useState('');
  const [cols, setCols] = useState<Column[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nextKey, setNextKey] = useState(0);

  useEffect(() => {
    if (!open || !template) return;
    const out = template.outputHeaders ?? [];
    const al = template.headerAliases ?? [];
    setName(template.name);
    setCols(template.headers.map((h, i) => ({
      key: i,
      match: String(h ?? ''),
      output: String(out[i] ?? ''),
      alias: (al[i] ?? []).join(', '),
    })));
    setNextKey(template.headers.length);
    setError('');
  }, [open, template]);

  if (!open || !template) return null;

  const patch = (i: number, p: Partial<Column>) =>
    setCols(prev => prev.map((c, idx) => (idx === i ? { ...c, ...p } : c)));

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= cols.length) return;
    setCols(prev => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const addColumn = () => {
    setCols(prev => [...prev, { key: nextKey, match: '', output: '', alias: '' }]);
    setNextKey(k => k + 1);
  };

  const removeColumn = (i: number) => setCols(prev => prev.filter((_, idx) => idx !== i));

  // 매칭용 이름이 겹치면 주문서에서 어느 열을 꺼낼지 정해지지 않는다
  const duplicates = (() => {
    const seen = new Set<string>();
    const dup = new Set<string>();
    cols.forEach(c => {
      const v = c.match.trim();
      if (!v) return;
      if (seen.has(v)) dup.add(v);
      seen.add(v);
    });
    return dup;
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) { setError('양식 이름을 입력하세요.'); return; }
    if (takenNames.some(n => n.trim() === trimmedName)) { setError(`이미 있는 양식 이름입니다: ${trimmedName}`); return; }

    const cleaned = cols.filter(c => c.match.trim() !== '');
    if (cleaned.length === 0) { setError('열이 하나도 없습니다. 매칭용 이름을 하나 이상 넣어주세요.'); return; }
    if (cleaned.length !== cols.length) { setError('매칭용 이름이 빈 열이 있습니다. 채우거나 지워주세요.'); return; }
    if (duplicates.size > 0) { setError(`매칭용 이름이 겹칩니다: ${Array.from(duplicates).join(', ')}`); return; }

    const headers = cleaned.map(c => c.match.trim());
    // 출력용을 하나도 안 채웠으면 빈 배열로 넘겨 1행을 그대로 쓰게 한다
    const outputs = cleaned.map(c => (c.output.trim() || c.match.trim()));
    const anyOutput = cleaned.some(c => c.output.trim() !== '');
    const aliases = cleaned.map(c =>
      c.alias.split(',').map(v => v.trim()).filter(Boolean));

    setSaving(true);
    try {
      await onSave(trimmedName, headers, anyOutput ? outputs : [], aliases);
    } catch (err: any) {
      setError(err?.message || '저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/10';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-fade-in">

        <div className="px-6 py-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet size={18} /> 송장 양식 편집
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
        </div>

        <form onSubmit={submit} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 pt-5 pb-3 shrink-0 space-y-3">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-700 rounded-lg px-3 py-2 text-xs flex items-start gap-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold text-slate-500 mb-1.5 block">양식 이름</label>
              <input className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-[11px] text-slate-600 flex items-start gap-2 leading-relaxed">
              <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
              <span>
                <b>매칭용</b>은 주문서에서 값을 꺼낼 때 쓰는 이름입니다. 주문서의 열 제목과 같아야 값이 들어옵니다.<br />
                <b>출력용</b>은 발주처에 보낼 파일에 실제로 찍히는 이름입니다. 비워두면 매칭용을 그대로 씁니다.
                {aliasSupported && <><br /><b>다른 이름</b>은 주문서마다 열 제목이 다를 때 함께 인정할 이름입니다.
                쉼표로 여러 개 넣으세요. 예) 수취인명 → <code>받는분, 수령인, 받는사람</code></>}
              </span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 w-10">순서</th>
                  <th className="py-2">매칭용 (1행)</th>
                  <th className="py-2">출력용 (2행)</th>
                  {aliasSupported && <th className="py-2">다른 이름 (쉼표 구분)</th>}
                  <th className="py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {cols.map((c, i) => {
                  const isDup = c.match.trim() !== '' && duplicates.has(c.match.trim());
                  return (
                    <tr key={c.key} className="border-b border-slate-50">
                      <td className="py-1.5 text-center text-slate-400 font-mono">{i + 1}</td>
                      <td className="py-1.5 pr-2">
                        <input className={`${inputCls} ${isDup ? 'border-red-300 bg-red-50' : ''}`}
                          value={c.match} placeholder="예: 수취인명"
                          onChange={e => patch(i, { match: e.target.value })} />
                      </td>
                      <td className="py-1.5 pr-2">
                        <input className={inputCls} value={c.output} placeholder={c.match.trim() || '비우면 매칭용과 동일'}
                          onChange={e => patch(i, { output: e.target.value })} />
                      </td>
                      {aliasSupported && (
                        <td className="py-1.5 pr-2">
                          <input className={inputCls} value={c.alias} placeholder="받는분, 수령인"
                            onChange={e => patch(i, { alias: e.target.value })} />
                        </td>
                      )}
                      <td className="py-1.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                            className="p-1 text-slate-400 hover:text-primary disabled:opacity-20" title="위로"><ChevronUp size={15} /></button>
                          <button type="button" onClick={() => move(i, 1)} disabled={i === cols.length - 1}
                            className="p-1 text-slate-400 hover:text-primary disabled:opacity-20" title="아래로"><ChevronDown size={15} /></button>
                          <button type="button" onClick={() => removeColumn(i)}
                            className="p-1 text-slate-300 hover:text-red-500" title="이 열 삭제"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <button type="button" onClick={addColumn}
              className="my-3 flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-primary">
              <Plus size={13} /> 열 추가
            </button>
          </div>

          <div className="px-6 py-3 border-t bg-slate-50 shrink-0 flex items-center gap-3">
            <span className="text-[11px] text-slate-500 flex-1">
              열 {cols.length}개
              {duplicates.size > 0 && <span className="text-red-500 font-bold ml-2">매칭용 이름 중복 {duplicates.size}건</span>}
            </span>
            <button type="button" onClick={onClose}
              className="px-5 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">취소</button>
            <button type="submit" disabled={saving}
              className="px-6 py-2 text-sm font-bold text-white bg-primary rounded-lg hover:bg-primary-hover shadow-lg shadow-primary/20 disabled:opacity-50">
              {saving ? '저장 중…' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
