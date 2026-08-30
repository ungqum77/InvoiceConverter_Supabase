
/** 과세 구분 */
export type VatType = 'taxable' | 'exempt';

/**
 * 발주처 마스터.
 * 이전에는 제품마다 발주처명을 자유 텍스트로 입력해서 "한일식품"과 "한일 식품"이
 * 서로 다른 업체로 갈라졌다. 이제 발주처를 별도 레코드로 등록하고 제품은 참조만 한다.
 */
export interface Supplier {
  id: string;
  name: string;          // 발주처명 (고유)
  code?: string;         // 내부 관리 코드
  manager?: string;      // 담당자
  phone?: string;
  email?: string;
  bizNo?: string;        // 사업자등록번호
  paymentTerms?: string; // 결제 조건 (예: 월말결산 익월 15일)
  /** 제품에 등록된 매입가가 부가세를 포함한 금액인지 여부. 기본 true(포함) */
  vatIncluded: boolean;
  memo?: string;
  user_id?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  additionalName?: string; // 추가 제품명
  useAdditionalName?: boolean; // 추가 제품명 사용 여부
  supplierName: string; // 발주처명 (표시/하위호환용. 정본은 supplierId)
  supplierId?: string;  // 발주처 마스터 참조
  templateId: string; // Links to an InvoiceTemplate
  user_id?: string; // Supabase owner

  // Financial Fields (New)
  purchaseCost?: number; // 매입가 (발주처에 줄 돈)
  salesPrice?: number;   // 판매가 (고객에게 받은 돈)
  shippingCost?: number; // 택배비용
  otherCost?: number;    // 기타비용 (포장비 등)
  marketFeeRate?: number; // 마켓 수수료율 (%)
  vatType?: VatType;      // 과세/면세 구분 (기본 과세)
  /** 같은 수취인·주소로 가는 같은 발주처 제품끼리 송장 한 장으로 묶어도 되는지 */
  bundleShipping?: boolean;
}

export interface SalesRecord {
  id: string;
  user_id: string;
  product_id?: string;
  product_name: string;
  product_sku: string;
  supplier_name: string;
  supplier_id?: string;
  order_id?: string; // 주문번호 (중복 체크용)
  quantity: number;

  unit_sales_price: number;
  unit_purchase_cost: number;

  total_sales_amount: number; // 매출액
  total_purchase_amount: number; // 매입액 (정산금, 부가세 포함 합계)
  total_supply_amount?: number;  // 매입 공급가액 (부가세 제외)
  total_vat_amount?: number;     // 매입 부가세
  total_shipping_cost: number;
  total_market_fee: number;
  net_profit: number; // 순수익
  
  order_date: string;
  created_at: string;
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  headers: string[]; // (Row 1) Input Headers: 주문서 매핑용 헤더
  outputHeaders?: string[]; // (Row 2) Output Headers: 최종 출력용 헤더 (Optional)
  /**
   * 열별 '다른 이름'. headers 와 같은 순서·길이.
   * 주문서마다 열 제목이 달라지는 것을 흡수한다.
   * 예) headers[1]='수취인명' 이면 headerAliases[1]=['받는분','수령인']
   */
  headerAliases?: string[][];
  user_id?: string; // Supabase owner
}

export interface InvoiceRow {
  [key: string]: string | number | undefined;
}

export interface MatchedOrder {
  id: string;
  originalData: InvoiceRow;
  product?: Product;
  status: 'matched' | 'unmatched';
  templateId?: string;
  quantity: number; // 수량 추가
}

export interface ColumnMapping {
  sku: string;
  productName: string; 
  orderer: string; 
  receiver: string; 
  option: string; 
  quantity: string; // (New) 수량 열
  orderId: string; // (New) 주문번호 열
  address: string; // (New) 주소 열 — 묶음배송 판단에 사용
}

export interface Tier {
  id: string;
  name: string;
  max_products: number;
  max_templates: number;
  max_crm_count?: number; // New: CRM Storage Limit
}

export interface UserProfile {
  id: string;
  email: string;
  tier_id: string;
  role?: 'user' | 'admin' | 'super_admin'; 
  tier?: Tier; 
  subscription_start_date?: string; 
  subscription_end_date?: string;   
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  description: string;
  created_at: string;
  user_email?: string; 
}

export interface AppSettings {
    silver_subscription_url: string;
    gold_subscription_url: string;
    youtube_tutorial_template: string;
    youtube_tutorial_product: string;
    youtube_tutorial_convert: string;
    price_silver_original: string;
    price_silver_sale: string;
    price_gold_original: string;
    price_gold_sale: string;
}

export interface AnalyticsEvent {
  id: string;
  event_type: 'visit' | 'signup' | 'login' | 'click_subscription' | 'payment_success' | 'delete_account';
  user_id?: string;
  metadata?: {
    is_new_visitor?: boolean;
    tier?: string;
    page?: string;
    [key: string]: any;
  };
  created_at: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  thumbnail_url?: string;
  is_published: boolean;
  author_id?: string;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface UserGuide {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  thumbnail_url?: string;
  is_published: boolean;
  sort_order: number;
  author_id?: string;
  created_at: string;
  updated_at: string;
}
