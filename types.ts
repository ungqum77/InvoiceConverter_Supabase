
export interface Product {
  id: string;
  sku: string;
  name: string;
  additionalName?: string; // 추가 제품명
  useAdditionalName?: boolean; // 추가 제품명 사용 여부
  supplierName: string; // 발주처명 (Company Name)
  templateId: string; // Links to an InvoiceTemplate
  user_id?: string; // Supabase owner
  
  // Financial Fields (New)
  purchaseCost?: number; // 매입가 (발주처에 줄 돈)
  salesPrice?: number;   // 판매가 (고객에게 받은 돈)
  shippingCost?: number; // 택배비용
  otherCost?: number;    // 기타비용 (포장비 등)
  marketFeeRate?: number; // 마켓 수수료율 (%)
}

export interface SalesRecord {
  id: string;
  user_id: string;
  product_id?: string;
  product_name: string;
  product_sku: string;
  supplier_name: string;
  order_id?: string; // 주문번호 (중복 체크용)
  quantity: number;
  
  unit_sales_price: number;
  unit_purchase_cost: number;
  
  total_sales_amount: number; // 매출액
  total_purchase_amount: number; // 매입액 (정산금)
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
