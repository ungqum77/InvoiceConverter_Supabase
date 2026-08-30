# 송장.com — InvoiceConverter

쇼핑몰 주문서(엑셀)를 읽어 **발주처별 발주서/송장 파일로 자동 분배**하고,
**각 발주처에 지급할 금액을 계산**해주는 웹 앱입니다.

React 19 + Vite + TypeScript + Supabase.

---

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # 배포용 빌드 (dist/)
```

Supabase 접속 정보는 `services/supabase.ts`에 들어 있습니다.
(anon 키는 공개되어도 되는 키입니다 — 단, **RLS가 켜져 있어야** 합니다. 아래 참고)

## 처음 받았다면: 마이그레이션 먼저

`supabase/migration.sql`을 Supabase 대시보드 → SQL Editor에 붙여넣고 실행하세요.
실행 전까지 발주처 마스터와 부가세 기능은 자동으로 비활성 상태가 되며,
기존 기능은 그대로 동작합니다. (앱이 스키마를 감지해서 알아서 처리합니다)

---

## 폴더 구조

```
index.html / index.tsx / App.tsx     진입점 · 라우팅
pages/
  Home.tsx                  랜딩 페이지
  Auth.tsx                  로그인 / 가입
  InvoiceConverter.tsx      ★ 주문서 → 발주처별 파일 변환 (핵심 기능)
  ProductManagement.tsx     ★ 송장 양식 · 발주처 · 제품(SKU) 관리
  InvoiceMatcher.tsx        택배사 회신 송장번호를 원본 주문서에 병합 (관리자)
  SalesCRM.tsx              매출/정산 통계
  AdminDashboard.tsx        운영자 대시보드
  Blog* / UserGuide* / Privacy / Terms
components/                 Button · Navbar · Footer
contexts/AuthContext.tsx    로그인 상태
services/
  supabase.ts               Supabase 클라이언트
  dbService.ts              모든 DB 접근 (snake_case ↔ camelCase 매핑)
  calc.ts                   ★ 금액 계산 단일 소스 (부가세 포함)
  storageService.ts
supabase/migration.sql      DB 마이그레이션 + RLS 점검 스크립트
types.ts                    공용 타입
```

---

## 핵심 개념

### 1. 송장 양식 (invoice_templates)
발주처가 요구하는 엑셀 양식을 그대로 업로드해서 등록합니다.

- **1행** = 주문서 매칭용 헤더 (내 주문서의 어떤 컬럼을 가져올지)
- **2행** (선택) = 실제 출력 헤더 (발주처에게 보낼 때 찍힐 이름)

### 2. 발주처 (suppliers)
돈을 지급할 공급업체. **제품은 발주처를 목록에서 선택**합니다.
예전에는 제품마다 이름을 직접 입력해서 "한일식품"과 "한일 식품"이 다른 업체로
갈라졌지만, 이제 그럴 수 없습니다.

발주처마다 `vat_included`(매입가가 부가세 포함가인지)를 설정합니다.

### 3. 제품 (products)
SKU 1개 = 1레코드. SKU를 기준으로 주문서와 대조하고,
**발주처 송장에 찍힐 이름**은 다음 우선순위로 결정됩니다.

1. `대체제품명`(additionalName) — 사용 토글이 켜져 있으면 최우선
2. 주문서의 옵션 열 — 매핑에서 옵션 열을 지정했을 때
3. 제품명(name)

### 4. 금액 계산
**모든 금액 계산은 `services/calc.ts` 한 곳에서만** 이루어집니다.
UI 미리보기와 실제 정산이 어긋나지 않도록 하기 위한 규칙이니 지켜주세요.

| 구분 | 공급가액 | 부가세 | 지급액 |
|---|---|---|---|
| 과세 · 매입가 부가세 **포함** (기본) | 지급액 ÷ 1.1 | 지급액 − 공급가액 | 단가 × 수량 |
| 과세 · 매입가 부가세 **별도** | 단가 × 수량 | 공급가액 × 10% | 공급가액 + 부가세 |
| 면세 | 단가 × 수량 | 0 | 공급가액 |

기본값이 '부가세 포함'인 이유는 **기존 데이터의 지급액이 달라지지 않게** 하기 위함입니다.

---

## 결과물

`InvoiceConverter`에서 변환하면 다음이 만들어집니다.

```
2026/08/30_Sat/
  한일식품/한일식품.xlsx        ← 발주처별 파일 (양식 그대로)
  그린팜/그린팜.xlsx
  00_정산요약_30.xlsx           ← 발주처 / 품목수 / 총수량 / 공급가액 / 부가세 / 지급액 / 결제조건
```

두 가지 저장 방식이 있습니다.

- **ZIP 다운로드** — 위 구조를 zip으로 내려받음
- **폴더 자동 저장** — 지정한 폴더에 바로 쓰고, 같은 날 다시 돌리면 **이어붙이면서 중복 주문은 건너뜀**
  (Chrome/Edge의 File System Access API 사용)

### 폴더 자동 저장의 중복 판정
`주문번호 + 주문자 + 수취인 + 제품명`을 **컬럼 이름으로** 대조합니다.

- 송장 양식에 주문번호·주문자·수취인 컬럼이 하나도 없으면 **행 전체**를 비교합니다
  (제품명만으로 비교하면 같은 상품을 산 다른 고객이 누락되기 때문)
- 기존 파일의 헤더가 현재 양식과 다르면 **이어붙이지 않고 새 파일로 저장**한 뒤 알려줍니다
  (컬럼이 어긋난 채 append되면 데이터가 오염됩니다)

---

## 보안: RLS 확인 필수

`products`, `invoice_templates`, `sales_records`, `profiles`에 RLS(Row Level Security)가
켜져 있는지 반드시 확인하세요. anon 키는 소스에 공개되는 게 정상이지만,
**RLS가 없으면 그 키만으로 다른 사용자의 데이터를 읽을 수 있습니다.**

확인 방법은 `supabase/migration.sql` 하단의 4번 섹션에 있습니다.

---

## 개발 시 주의

- 금액 공식을 바꿀 일이 생기면 `services/calc.ts`만 고칩니다. 화면에 직접 계산식을 쓰지 마세요.
- DB 컬럼을 추가하면 `dbService.ts`의 매핑 함수와 `getSchemaSupport()`도 함께 갱신하세요.
- 마이그레이션을 아직 실행하지 않은 사용자를 위해, 새 컬럼은 `getSchemaSupport()`로
  지원 여부를 확인한 뒤에만 읽고 씁니다.
