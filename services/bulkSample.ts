import * as XLSX from 'xlsx';
import JSZip from 'jszip';

/**
 * 제품 대량 등록용 샘플 엑셀을 만든다.
 *
 * 송장 양식·발주처는 이미 DB에 등록돼 있으므로, 그 이름을 손으로 타이핑하게 두면
 * 오타 하나로 행 전체가 탈락한다. 그래서 두 번째 시트에 등록된 이름을 깔고
 * 첫 시트의 해당 열에 드롭다운(데이터 유효성 검사)을 걸어준다.
 *
 * xlsx 라이브러리는 데이터 유효성 검사 '쓰기'를 지원하지 않는다.
 * xlsx 파일은 zip 이므로, 만들어진 워크북을 jszip 으로 열어 시트 XML 에 직접 넣는다.
 */

const LIST_SHEET = '선택목록';
const DATA_SHEET = '제품';
const MAX_ROW = 500;             // 드롭다운을 걸어둘 행 범위

/** 제품 시트의 열 순서. 대량 등록 화면의 자동 인식 순서와 맞춰둔다. */
const COLUMNS = [
  'SKU', '제품명', '별칭', '별칭사용', '발주처', '송장양식',
  '매입가', '판매가', '배송비', '기타비용', '수수료율', '과세구분',
] as const;

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

interface Validation {
  /** 적용할 범위 (예: 'F2:F500') */
  sqref: string;
  /** 목록이 있는 곳 (예: "선택목록!$A$2:$A$9") */
  source: string;
}

const buildValidationXml = (list: Validation[]): string => {
  if (list.length === 0) return '';
  const items = list.map(v =>
    `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1"` +
    ` errorStyle="warning" errorTitle="${escapeXml('목록에 없는 값')}"` +
    ` error="${escapeXml('등록된 목록에 없는 값입니다. 그대로 쓰시려면 예를 누르세요.')}"` +
    ` sqref="${v.sqref}"><formula1>${escapeXml(v.source)}</formula1></dataValidation>`
  ).join('');
  return `<dataValidations count="${list.length}">${items}</dataValidations>`;
};

/**
 * 워크시트 XML 에 dataValidations 를 끼워 넣는다.
 *
 * 엑셀은 요소 순서를 엄격하게 따진다 (CT_Worksheet 스키마). 순서가 틀리면
 * "파일을 복구해야 합니다" 가 뜨면서 유효성 검사가 통째로 날아간다.
 * dataValidations 보다 뒤에 와야 하는 요소들 중 첫 번째 앞에 넣는다.
 * xlsx 라이브러리는 실제로 sheetData 뒤에 ignoredErrors 를 붙이는 경우가 있다.
 */
const AFTER_DATA_VALIDATIONS =
  /<(hyperlinks|printOptions|pageMargins|pageSetup|headerFooter|rowBreaks|colBreaks|customProperties|cellWatches|ignoredErrors|smartTags|drawing|legacyDrawing|legacyDrawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/;

const injectValidations = (xml: string, block: string): string => {
  if (!block) return xml;
  const at = xml.search(AFTER_DATA_VALIDATIONS);
  if (at >= 0) return xml.slice(0, at) + block + xml.slice(at);
  return xml.replace('</worksheet>', block + '</worksheet>');
};

/** 워크북 안에서 특정 시트의 XML 경로를 찾는다. 시트 순서에만 의존하지 않는다. */
const findSheetPath = async (zip: JSZip, sheetIndex: number): Promise<string> => {
  const wbXml = await zip.file('xl/workbook.xml')?.async('string');
  const relsXml = await zip.file('xl/_rels/workbook.xml.rels')?.async('string');
  if (wbXml && relsXml) {
    const sheetTags = wbXml.match(/<sheet\b[^>]*\/?>/g) ?? [];
    const rid = sheetTags[sheetIndex]?.match(/r:id="([^"]+)"/)?.[1];
    if (rid) {
      const target = relsXml.match(new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`))?.[1];
      if (target) return 'xl/' + target.replace(/^\/?xl\//, '').replace(/^\.\//, '');
    }
  }
  return `xl/worksheets/sheet${sheetIndex + 1}.xml`;
};

export interface SampleOptions {
  templateNames: string[];
  supplierNames: string[];
  /** 발주처 마스터를 안 쓰는 스키마면 발주처 드롭다운을 걸지 않는다 */
  useSupplierMaster: boolean;
}

export const buildBulkSampleWorkbook = async (opts: SampleOptions): Promise<Blob> => {
  const { templateNames, supplierNames, useSupplierMaster } = opts;

  // ── 1) 제품 시트: 제목 줄 + 예시 두 줄 ──────────────────────────────────
  const example = [
    ['A-001', '양파 10kg', '햇양파 10kg(대)', 'Y',
     supplierNames[0] ?? '', templateNames[0] ?? '', 12000, 19000, 3000, 0, 10, '과세'],
    ['A-002', '감자 5kg', '', 'N',
     supplierNames[0] ?? '', templateNames[0] ?? '', 8000, 13000, 3000, 0, 10, '면세'],
  ];
  const dataWs = XLSX.utils.aoa_to_sheet([[...COLUMNS], ...example]);
  dataWs['!cols'] = COLUMNS.map(c => ({ wch: c === '제품명' || c === '별칭' ? 20 : 12 }));

  // ── 2) 선택목록 시트 ────────────────────────────────────────────────────
  const vatOptions = ['과세', '면세'];
  const yesNo = ['Y', 'N'];
  const height = Math.max(templateNames.length, supplierNames.length, vatOptions.length, yesNo.length);
  const listRows: string[][] = [['송장양식', '발주처', '과세구분', '별칭사용']];
  for (let i = 0; i < height; i++) {
    listRows.push([
      templateNames[i] ?? '',
      supplierNames[i] ?? '',
      vatOptions[i] ?? '',
      yesNo[i] ?? '',
    ]);
  }
  const listWs = XLSX.utils.aoa_to_sheet(listRows);
  listWs['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 10 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, dataWs, DATA_SHEET);
  XLSX.utils.book_append_sheet(wb, listWs, LIST_SHEET);

  // ── 3) 드롭다운 정의 ────────────────────────────────────────────────────
  // 목록이 비어 있으면 범위가 빈 셀만 가리켜 엑셀이 경고를 낸다. 그래서 건너뛴다.
  const validations: Validation[] = [];
  const rangeOf = (col: string, count: number) => `${LIST_SHEET}!$${col}$2:$${col}$${count + 1}`;

  if (templateNames.length > 0)
    validations.push({ sqref: `F2:F${MAX_ROW}`, source: rangeOf('A', templateNames.length) });
  if (useSupplierMaster && supplierNames.length > 0)
    validations.push({ sqref: `E2:E${MAX_ROW}`, source: rangeOf('B', supplierNames.length) });
  validations.push({ sqref: `L2:L${MAX_ROW}`, source: rangeOf('C', vatOptions.length) });
  validations.push({ sqref: `D2:D${MAX_ROW}`, source: rangeOf('D', yesNo.length) });

  // ── 4) 생성 후 XML 에 주입 ──────────────────────────────────────────────
  const raw = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const zip = await JSZip.loadAsync(raw);
  const path = await findSheetPath(zip, 0);
  const sheetXml = await zip.file(path)?.async('string');
  if (sheetXml) zip.file(path, injectValidations(sheetXml, buildValidationXml(validations)));

  return zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
