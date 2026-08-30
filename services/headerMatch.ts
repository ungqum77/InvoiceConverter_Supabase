/**
 * 송장 양식의 열 이름과 주문서의 열 제목을 연결한다.
 *
 * 예전에는 `주문서행[양식열이름]` 으로 글자가 완전히 같을 때만 값을 꺼냈다.
 * 쿠팡·네이버가 열 제목을 조금만 바꾸거나 공백 하나만 달라도 값이 조용히
 * 빈칸으로 나갔다. 그래서 다음 순서로 찾는다.
 *
 *   1) 완전 일치
 *   2) 정규화 일치      — 공백·괄호·기호 제거, 대소문자 무시
 *   3) 별칭 일치        — 양식에 등록해둔 '다른 이름'
 *   4) 포함 관계        — '연락처1' ↔ '연락처'
 *   5) 유사도           — 편집거리 기준, 기본 0.75 이상만
 *
 * 4·5로 찾은 것은 추측이므로 화면에서 확인받는다.
 */

export type MatchKind = 'exact' | 'normalized' | 'alias' | 'contains' | 'similar' | 'manual' | 'none';

export interface HeaderResolution {
  /** 양식의 열 이름 (매칭용) */
  header: string;
  /** 연결된 주문서 열 제목. 못 찾으면 '' */
  orderHeader: string;
  kind: MatchKind;
  /** 0~1. exact/normalized/alias/manual 은 1 */
  score: number;
}

/** 비교용으로 다듬는다. 공백·괄호·구분기호를 없애고 소문자로. */
export const normalizeHeader = (s: unknown): string =>
  String(s ?? '')
    .replace(/[\s\u200B-\u200D\uFEFF]/g, '')
    .replace(/[()[\]{}<>·・.,\-_/\\|:;'"`~!@#$%^&*+=?]/g, '')
    .toLowerCase();

/** 편집거리 (Levenshtein). 짧은 문자열만 다루므로 단순 구현으로 충분하다. */
const editDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length];
};

/** 0~1 사이 유사도 */
export const similarity = (a: string, b: string): number => {
  const x = normalizeHeader(a);
  const y = normalizeHeader(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const longer = Math.max(x.length, y.length);
  return 1 - editDistance(x, y) / longer;
};

export const SIMILARITY_THRESHOLD = 0.75;

/**
 * 주소 비교용 정규화. 묶음배송에서 같은 집인지 판단할 때 쓴다.
 *
 * 같은 집도 표기가 갈린다.  "101동 1201호" / "101-1201" / "101 1201"
 * 숫자 뒤에 붙은 동·호·층·번지 표시를 떼고 나머지는 headerMatch 규칙(공백·기호 제거)을
 * 그대로 적용해 세 가지가 같은 값이 되게 한다.
 */
export const normalizeAddress = (s: unknown): string =>
  normalizeHeader(String(s ?? '').replace(/(\d)\s*(동|호|층|번지)/g, '$1'));

export interface ResolveOptions {
  /** 양식 열별 별칭. headers 와 같은 순서 */
  aliases?: string[][];
  /** 사용자가 화면에서 직접 고른 연결. 양식 열 이름 → 주문서 열 제목 */
  manual?: Record<string, string>;
  threshold?: number;
}

/**
 * 양식의 열 목록을 주문서 열 목록에 연결한다.
 * 한 주문서 열이 여러 양식 열에 중복으로 붙는 것은 막지 않는다
 * (같은 값을 두 칸에 넣어야 하는 양식이 실제로 있다).
 */
export const resolveHeaders = (
  templateHeaders: string[],
  orderHeaders: string[],
  opts: ResolveOptions = {},
): HeaderResolution[] => {
  const { aliases = [], manual = {}, threshold = SIMILARITY_THRESHOLD } = opts;

  const normToOrder = new Map<string, string>();
  for (const oh of orderHeaders) {
    const n = normalizeHeader(oh);
    if (n && !normToOrder.has(n)) normToOrder.set(n, oh);
  }

  return templateHeaders.map((header, i) => {
    const done = (orderHeader: string, kind: MatchKind, score: number): HeaderResolution =>
      ({ header, orderHeader, kind, score });

    // 0) 사용자가 직접 지정한 것이 최우선
    const picked = manual[header];
    if (picked !== undefined) {
      return picked ? done(picked, 'manual', 1) : done('', 'none', 0);
    }

    // 1) 완전 일치
    if (orderHeaders.includes(header)) return done(header, 'exact', 1);

    // 2) 정규화 일치
    const norm = normalizeHeader(header);
    const byNorm = normToOrder.get(norm);
    if (byNorm) return done(byNorm, 'normalized', 1);

    // 3) 별칭
    for (const alias of aliases[i] ?? []) {
      const hit = normToOrder.get(normalizeHeader(alias));
      if (hit) return done(hit, 'alias', 1);
    }

    // 4) 포함 관계. 너무 짧은 이름은 엉뚱한 것에 붙으므로 2글자 이상만
    if (norm.length >= 2) {
      const contains = orderHeaders.find(oh => {
        const n = normalizeHeader(oh);
        return n.length >= 2 && (n.includes(norm) || norm.includes(n));
      });
      if (contains) return done(contains, 'contains', 0.9);
    }

    // 5) 유사도
    let best = '';
    let bestScore = 0;
    for (const oh of orderHeaders) {
      const sc = similarity(header, oh);
      if (sc > bestScore) { bestScore = sc; best = oh; }
    }
    if (best && bestScore >= threshold) return done(best, 'similar', bestScore);

    return done('', 'none', 0);
  });
};

/** 확인이 필요한 연결 (추측으로 붙였거나 못 붙인 것) */
export const needsReview = (r: HeaderResolution): boolean =>
  r.kind === 'contains' || r.kind === 'similar' || r.kind === 'none';

export const KIND_LABEL: Record<MatchKind, string> = {
  exact: '일치',
  normalized: '일치(표기차이)',
  alias: '별칭',
  contains: '추측(포함)',
  similar: '추측(유사)',
  manual: '직접 지정',
  none: '연결 안 됨',
};

/** 연결 결과를 빠른 조회용 맵으로. 값이 없으면 빈 문자열 */
export const toLookup = (list: HeaderResolution[]): Record<string, string> =>
  list.reduce<Record<string, string>>((acc, r) => { acc[r.header] = r.orderHeader; return acc; }, {});
