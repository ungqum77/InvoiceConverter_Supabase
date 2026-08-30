/**
 * 금액 계산 단일 소스 (Single Source of Truth)
 * ------------------------------------------------------------------
 * 이전에는 ProductManagement.tsx(개당 예상마진)와 InvoiceConverter.tsx(CRM 저장)에
 * 같은 공식이 따로 구현되어 있어 수수료 반올림 시점이 달랐다.
 * 금액과 관련된 계산은 반드시 이 파일의 함수만 사용한다.
 */

import { Product, VatType } from '../types';

/** 부가가치세율 (10%) */
export const VAT_RATE = 0.1;

export interface AmountBreakdown {
  /** 공급가액 (부가세 제외) */
  supply: number;
  /** 부가세 */
  vat: number;
  /** 합계 = 실제 발주처에 지급할 금액 */
  total: number;
}

export const emptyBreakdown = (): AmountBreakdown => ({ supply: 0, vat: 0, total: 0 });

export const addBreakdown = (a: AmountBreakdown, b: AmountBreakdown): AmountBreakdown => ({
  supply: a.supply + b.supply,
  vat: a.vat + b.vat,
  total: a.total + b.total,
});

/**
 * 매입금액을 공급가액 / 부가세 / 합계로 분해한다.
 *
 * @param unitCost        매입 단가 (제품에 등록된 값)
 * @param qty             수량
 * @param vatType         'taxable'(과세) | 'exempt'(면세)
 * @param costIncludesVat 매입 단가가 부가세를 포함한 금액인지 여부.
 *                        기존 데이터와의 호환을 위해 기본값은 true(포함)이며,
 *                        이 경우 합계(total)는 예전과 동일하게 단가 × 수량이 된다.
 */
export function calcPurchase(
  unitCost: number,
  qty: number,
  vatType: VatType = 'taxable',
  costIncludesVat: boolean = true,
): AmountBreakdown {
  const c = Number(unitCost) || 0;
  const q = Math.max(0, Number(qty) || 0);

  // 면세 품목: 부가세가 붙지 않는다.
  if (vatType === 'exempt') {
    const supply = Math.round(c * q);
    return { supply, vat: 0, total: supply };
  }

  // 과세 + 단가가 부가세 포함가인 경우: 합계에서 역산한다.
  if (costIncludesVat) {
    const total = Math.round(c * q);
    const supply = Math.round(total / (1 + VAT_RATE));
    return { supply, vat: total - supply, total };
  }

  // 과세 + 단가가 부가세 별도인 경우: 공급가액에 10%를 더한다.
  const supply = Math.round(c * q);
  const vat = Math.round(supply * VAT_RATE);
  return { supply, vat, total: supply + vat };
}

export interface ProfitInput {
  salesPrice?: number;
  purchaseCost?: number;
  shippingCost?: number;
  otherCost?: number;
  marketFeeRate?: number;
  vatType?: VatType;
  /** 발주처 설정값. 미지정 시 true(부가세 포함가) */
  costIncludesVat?: boolean;
  /** 기본 1 (제품 목록의 '개당 예상마진'은 1로 호출한다) */
  qty?: number;
}

export interface ProfitResult {
  qty: number;
  salesAmount: number;
  purchase: AmountBreakdown;
  shippingAmount: number;
  otherAmount: number;
  marketFee: number;
  netProfit: number;
}

/**
 * 순수익 = 매출액 − 매입액(부가세 포함 합계) − 택배비 − 기타비용 − 마켓수수료
 *
 * 주의: 매입액은 `purchase.total`을 차감한다. 매입 단가가 부가세 포함가라면(기본값)
 * total === 단가 × 수량 이므로 기존 계산 결과와 완전히 동일하다.
 */
export function calcProfit(input: ProfitInput): ProfitResult {
  const qty = Math.max(0, Number(input.qty ?? 1) || 0);
  const salesAmount = Math.round((Number(input.salesPrice) || 0) * qty);
  const purchase = calcPurchase(
    input.purchaseCost || 0,
    qty,
    input.vatType || 'taxable',
    input.costIncludesVat ?? true,
  );
  const shippingAmount = Math.round((Number(input.shippingCost) || 0) * qty);
  const otherAmount = Math.round((Number(input.otherCost) || 0) * qty);
  const marketFee = Math.round(salesAmount * ((Number(input.marketFeeRate) || 0) / 100));
  const netProfit = salesAmount - purchase.total - shippingAmount - otherAmount - marketFee;

  return { qty, salesAmount, purchase, shippingAmount, otherAmount, marketFee, netProfit };
}

/** 제품 레코드로부터 바로 계산 (발주처의 부가세 포함 여부를 함께 넘긴다) */
export function calcProductProfit(
  product: Pick<Product, 'salesPrice' | 'purchaseCost' | 'shippingCost' | 'otherCost' | 'marketFeeRate' | 'vatType'>,
  qty: number = 1,
  costIncludesVat: boolean = true,
): ProfitResult {
  return calcProfit({
    salesPrice: product.salesPrice,
    purchaseCost: product.purchaseCost,
    shippingCost: product.shippingCost,
    otherCost: product.otherCost,
    marketFeeRate: product.marketFeeRate,
    vatType: product.vatType,
    costIncludesVat,
    qty,
  });
}

export const won = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`;
