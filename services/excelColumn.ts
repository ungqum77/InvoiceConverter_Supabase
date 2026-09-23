/**
 * 열 번호를 엑셀 열 문자로 바꾼다. 0 → 'A', 25 → 'Z', 26 → 'AA'
 *
 * 화면에서 1, 2, 3 으로 세는 것보다 엑셀을 열어놓고 비교할 때 훨씬 빠르다.
 * 송장 양식 편집과 대량등록 샘플의 드롭다운 범위가 같은 규칙을 쓴다.
 */
export const colLetter = (index: number): string => {
  let n = index, out = '';
  do { out = String.fromCharCode(65 + (n % 26)) + out; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return out;
};
