
export interface Product {
  id: string;
  sku: string;
  name: string;
  additionalName?: string; // 추가 제품명
  useAdditionalName?: boolean; // 추가 제품명 사용 여부
  supplierName: string; // 발주처명 (Company Name)
  templateId: string; // Links to an InvoiceTemplate
  user_id?: string; // Supabase owner
}

export interface InvoiceTemplate {
  id: string;
  name: string;
  headers: string[]; // (Row 1) Input Headers: 주문서 매핑용 헤더
  outputHeaders?: string[]; // (Row 2) Output Headers: 최종 출력용 헤더 (Optional)
  user_id?: string; // Supabase owner
}

// Removed complicated mapping types as we strictly follow header name matching now
export interface InvoiceRow {
  [key: string]: string | number | undefined;
}

export interface MatchedOrder {
  id: string;
  originalData: InvoiceRow;
  product?: Product;
  status: 'matched' | 'unmatched';
  templateId?: string;
}

export interface ColumnMapping {
  sku: string;
  orderer: string; // 주문자명 열
  receiver: string; // 수취인명 열
  option: string; // (New) 옵션 정보 열 - 제품명 대체용
}

export interface Tier {
  id: string;
  name: string;
  max_products: number;
  max_templates: number;
}

export interface UserProfile {
  id: string;
  email: string;
  tier_id: string;
  role?: 'user' | 'admin' | 'super_admin'; // Updated roles
  tier?: Tier; // Join result
  subscription_start_date?: string; // ISO String
  subscription_end_date?: string;   // ISO String
}

export interface ActivityLog {
  id: string;
  user_id: string;
  action_type: string;
  description: string;
  created_at: string;
  user_email?: string; // For display purposes in Admin Log
}
