
import { supabase } from './supabase';
import { Product, InvoiceTemplate, UserProfile, Tier, ActivityLog, SalesRecord, AppSettings } from '../types';

export type { AppSettings };

// Helper to handle Supabase "snake_case" to "camelCase" mapping
const mapProductFromDB = (data: any): Product => ({
  id: data.id,
  sku: data.sku,
  name: data.name,
  additionalName: data.additional_name,
  useAdditionalName: data.use_additional_name,
  supplierName: data.supplier_name,
  templateId: data.template_id,
  user_id: data.user_id,
  // Financial Mapping
  purchaseCost: data.purchase_cost || 0,
  salesPrice: data.sales_price || 0,
  shippingCost: data.shipping_cost || 0,
  otherCost: data.other_cost || 0,
  marketFeeRate: data.market_fee_rate || 0,
});

const mapTemplateFromDB = (data: any): InvoiceTemplate => ({
  id: data.id,
  name: data.name,
  headers: data.headers,
  outputHeaders: data.output_headers || data.headers, 
  user_id: data.user_id,
});

// Tier Definitions
export const DEFAULT_TIERS: Record<string, Tier> = {
  free: { id: 'free', name: '무료 회원', max_products: 2, max_templates: 1, max_crm_count: 20 },
  silver: { id: 'silver', name: '실버 회원', max_products: 8, max_templates: 3, max_crm_count: 300 },
  gold: { id: 'gold', name: '골드 회원', max_products: 100, max_templates: 50, max_crm_count: 999999 },
  admin: { id: 'admin', name: '관리자', max_products: 9999, max_templates: 9999, max_crm_count: 999999 },
};

export const fetchAllTiers = async (): Promise<Tier[]> => {
    if (supabase) {
        try {
            const { data, error } = await supabase.from('tiers').select('*').order('max_products', { ascending: true });
            if (error) return Object.values(DEFAULT_TIERS);
            
            // Merge with DB data but ensure defaults if columns missing
            return (data || []).map((t: any) => ({
                ...DEFAULT_TIERS[t.id],
                ...t
            }));
        } catch (e) {
            return Object.values(DEFAULT_TIERS);
        }
    }
    return Object.values(DEFAULT_TIERS);
};

export const updateTier = async (id: string, updates: Partial<Tier>) => {
    if (supabase) {
        const { error } = await supabase.from('tiers').update(updates).eq('id', id);
        if (error) throw new Error(`등급 업데이트 실패: ${error.message}`);
    }
};

export const SETTING_KEYS: (keyof AppSettings)[] = [
    'silver_subscription_url', 'gold_subscription_url', 'youtube_tutorial_template', 
    'youtube_tutorial_product', 'youtube_tutorial_convert', 'price_silver_original', 
    'price_silver_sale', 'price_gold_original', 'price_gold_sale'
];

export const fetchAppSettings = async (): Promise<AppSettings> => {
    const defaults: AppSettings = {
        silver_subscription_url: '', gold_subscription_url: '', youtube_tutorial_template: '',
        youtube_tutorial_product: '', youtube_tutorial_convert: '',
        price_silver_original: '11000', price_silver_sale: '5500',
        price_gold_original: '15000', price_gold_sale: '8800'
    };
    if (!supabase) return JSON.parse(localStorage.getItem('demo_settings') || JSON.stringify(defaults));
    try {
        const { data, error } = await supabase.from('app_settings').select('key, value');
        if (error) return defaults;
        const settings: any = { ...defaults };
        if (data && data.length > 0) {
            data.forEach((row: any) => {
                if (SETTING_KEYS.includes(row.key as keyof AppSettings)) settings[row.key as keyof AppSettings] = row.value || '';
            });
        }
        return settings;
    } catch (e) { return defaults; }
};

export const updateAppSettings = async (settings: AppSettings) => {
    const payload = SETTING_KEYS.map(key => ({ key: key, value: settings[key] ? String(settings[key]).trim() : '' }));
    if (supabase) {
        const { error } = await supabase.from('app_settings').upsert(payload, { onConflict: 'key' });
        if (error) throw new Error(`저장 실패 (${error.code}): ${error.message}`);
    } else { localStorage.setItem('demo_settings', JSON.stringify(settings)); }
};

// --- Activity Logs ---
export const logActivity = async (userId: string, actionType: string, description: string) => {
  if (supabase) {
    try { await supabase.from('activity_logs').insert({ user_id: userId, action_type: actionType, description: description }); } catch (e) {}
  }
};
export const fetchActivityLogs = async (userId: string): Promise<ActivityLog[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('activity_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
    return error ? [] : data || [];
  }
  return [];
};
export const fetchAllActivityLogs = async (): Promise<ActivityLog[]> => {
    if (supabase) {
        const { data, error } = await supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(100);
        return (data || []).map((log: any) => ({ ...log, user_email: log.user_email || log.user_id }));
    }
    return [];
};

// --- User Profile ---
export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (supabase) {
    try {
        const { data, error } = await supabase.from('profiles').select('*, tier:tiers(*)').eq('id', userId).single();
        if (error) throw error;
        // Merge DB tier data with defaults to ensure all fields exist
        const dbTier = data.tier;
        const defaultTier = DEFAULT_TIERS[data.tier_id] || DEFAULT_TIERS['free'];
        const effectiveTier = dbTier ? { ...defaultTier, ...dbTier } : defaultTier;
        
        return { ...data, tier: effectiveTier };
    } catch (e) { return { id: userId, email: '', tier_id: 'free', role: 'user', tier: DEFAULT_TIERS['free'] }; }
  }
  return null;
};
export const fetchAllProfiles = async (): Promise<UserProfile[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map((p: any) => ({ ...p, tier: DEFAULT_TIERS[p.tier_id] || DEFAULT_TIERS['free'] }));
  }
  return [];
};
export const updateUserProfile = async (userId: string, updates: any) => {
    if (supabase) { const { error } = await supabase.from('profiles').update(updates).eq('id', userId); if (error) throw error; }
};
export const getUsageStats = async (userId: string) => {
  if (supabase) {
    try {
      const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      const { count: templateCount } = await supabase.from('invoice_templates').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      return { productCount: productCount || 0, templateCount: templateCount || 0 };
    } catch (e) { return { productCount: 0, templateCount: 0 }; }
  }
  return { productCount: 0, templateCount: 0 };
};

// --- Templates ---
export const fetchTemplates = async (): Promise<InvoiceTemplate[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('invoice_templates').select('*').order('created_at');
    if (error) throw error;
    return (data || []).map(mapTemplateFromDB);
  }
  return [];
};
export const createTemplate = async (template: Omit<InvoiceTemplate, 'id' | 'user_id'>): Promise<InvoiceTemplate> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 만료되었습니다.');
  const payload: any = { user_id: user.id, name: template.name, headers: template.headers };
  if (template.outputHeaders && template.outputHeaders.length > 0) { payload.output_headers = template.outputHeaders; }
  const { data, error } = await supabase.from('invoice_templates').insert(payload).select().single();
  if (error) throw error;
  await logActivity(user.id, 'CREATE_TEMPLATE', `송장 양식 '${template.name}' 생성`);
  return mapTemplateFromDB(data);
};
export const deleteTemplate = async (id: string): Promise<void> => {
  if (supabase) await supabase.from('invoice_templates').delete().eq('id', id);
};

// --- Products (Updated with Financials) ---
export const fetchProducts = async (): Promise<Product[]> => {
  if (supabase) {
    const { data, error } = await supabase.from('products').select('*').order('created_at');
    if (error) throw error;
    return (data || []).map(mapProductFromDB);
  }
  return [];
};
export const createProduct = async (product: Omit<Product, 'id' | 'user_id'>): Promise<Product> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 만료되었습니다.');
  const { data, error } = await supabase.from('products').insert({ 
    user_id: user.id, 
    sku: product.sku, 
    name: product.name, 
    additional_name: product.additionalName, 
    use_additional_name: product.useAdditionalName, 
    supplier_name: product.supplierName, 
    template_id: product.templateId,
    // Financials
    purchase_cost: product.purchaseCost,
    sales_price: product.salesPrice,
    shipping_cost: product.shippingCost,
    other_cost: product.otherCost,
    market_fee_rate: product.marketFeeRate
  }).select().single();
  if (error) throw error;
  await logActivity(user.id, 'CREATE_PRODUCT', `제품 '${product.sku}' 등록`);
  return mapProductFromDB(data);
};
export const createProductsBulk = async (products: Omit<Product, 'id' | 'user_id'>[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('인증이 만료되었습니다.');
    const payload = products.map(p => ({ 
      user_id: user.id, 
      sku: p.sku, 
      name: p.name, 
      additional_name: p.additionalName, 
      use_additional_name: p.useAdditionalName, 
      supplier_name: p.supplierName, 
      template_id: p.templateId,
      // Bulk financials (Optional in CSV, default 0)
      purchase_cost: p.purchaseCost || 0,
      sales_price: p.salesPrice || 0,
      shipping_cost: p.shippingCost || 0,
      other_cost: p.otherCost || 0,
      market_fee_rate: p.marketFeeRate || 0
    }));
    const { error } = await supabase.from('products').insert(payload);
    if (error) throw error;
    await logActivity(user.id, 'CREATE_PRODUCT_BULK', `${products.length}개의 제품 대량 등록`);
};
export const updateProduct = async (id: string, product: Partial<Product>): Promise<Product> => {
    const updates: any = {};
    if (product.sku !== undefined) updates.sku = product.sku;
    if (product.name !== undefined) updates.name = product.name;
    if (product.additionalName !== undefined) updates.additional_name = product.additionalName;
    if (product.useAdditionalName !== undefined) updates.use_additional_name = product.useAdditionalName;
    if (product.supplierName !== undefined) updates.supplier_name = product.supplierName;
    if (product.templateId !== undefined) updates.template_id = product.templateId;
    // Financials
    if (product.purchaseCost !== undefined) updates.purchase_cost = product.purchaseCost;
    if (product.salesPrice !== undefined) updates.sales_price = product.salesPrice;
    if (product.shippingCost !== undefined) updates.shipping_cost = product.shippingCost;
    if (product.otherCost !== undefined) updates.other_cost = product.otherCost;
    if (product.marketFeeRate !== undefined) updates.market_fee_rate = product.marketFeeRate;

    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return mapProductFromDB(data);
};
export const deleteProduct = async (id: string): Promise<void> => {
  if (supabase) await supabase.from('products').delete().eq('id', id);
};

// --- Sales & CRM ---
export interface SalesSaveResult {
    success: boolean;
    savedCount: number;
    skippedCount: number;
    skippedItems: any[];
    error?: 'LIMIT_REACHED' | string;
    countToDelete?: number;
}

export const deleteOldestSalesRecords = async (count: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('인증이 만료되었습니다.');

    // Find oldest IDs
    const { data, error } = await supabase
        .from('sales_records')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(count);
    
    if (error) throw error;
    if (!data || data.length === 0) return;

    const idsToDelete = data.map(d => d.id);
    const { error: delError } = await supabase
        .from('sales_records')
        .delete()
        .in('id', idsToDelete);
    
    if (delError) throw delError;
    await logActivity(user.id, 'ROTATE_SALES', `저장 공간 확보를 위해 오래된 데이터 ${idsToDelete.length}건 자동 삭제`);
};

export const saveSalesRecords = async (records: Omit<SalesRecord, 'id' | 'created_at'>[]): Promise<SalesSaveResult> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('인증이 만료되었습니다.');

    // 1. Check Limits based on User's Tier
    const profile = await getUserProfile(user.id);
    
    // Default fallback limits if not set in DB
    const tierLimit = profile?.tier?.max_crm_count ?? DEFAULT_TIERS[profile?.tier_id || 'free'].max_crm_count ?? 20;
    
    // For Gold/Admin, treat as unlimited if high number
    const effectiveLimit = tierLimit > 100000 ? 999999 : tierLimit;

    const { count: currentCount, error: countError } = await supabase
        .from('sales_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
    
    if (countError) throw countError;
    
    const incomingCount = records.length;
    const projectedCount = (currentCount || 0) + incomingCount;

    if (projectedCount > effectiveLimit) {
        return {
            success: false,
            savedCount: 0,
            skippedCount: 0,
            skippedItems: [],
            error: 'LIMIT_REACHED',
            countToDelete: projectedCount - effectiveLimit
        };
    }

    // 2. Extract Order IDs to check for duplicates
    const inputOrderIds = records.map(r => r.order_id).filter(Boolean) as string[];
    let newRecords = records;
    const skipped: any[] = [];

    if (inputOrderIds.length > 0) {
        const { data: existingData, error: fetchError } = await supabase
            .from('sales_records')
            .select('order_id, supplier_name, product_name')
            .in('order_id', inputOrderIds)
            .eq('user_id', user.id);
            
        if (fetchError) throw fetchError;

        if (existingData && existingData.length > 0) {
            newRecords = [];
            for (const rec of records) {
                // Duplicate Criteria: Order ID + Supplier + Product Name match
                const isDuplicate = existingData.some((existing: any) => 
                    existing.order_id === rec.order_id && 
                    existing.supplier_name === rec.supplier_name &&
                    existing.product_name === rec.product_name
                );

                if (isDuplicate) {
                    skipped.push(rec);
                } else {
                    newRecords.push(rec);
                }
            }
        }
    }

    if (newRecords.length > 0) {
        const { error } = await supabase.from('sales_records').insert(newRecords);
        if (error) throw error;
        await logActivity(user.id, 'SAVE_SALES', `${newRecords.length}건의 매출 기록 저장 (중복 ${skipped.length}건 제외)`);
    }

    return { success: true, savedCount: newRecords.length, skippedCount: skipped.length, skippedItems: skipped };
};

export const fetchSalesRecords = async (startDate: string, endDate: string): Promise<SalesRecord[]> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data, error } = await supabase
        .from('sales_records')
        .select('*')
        .eq('user_id', user.id)
        .gte('order_date', startDate)
        .lte('order_date', endDate)
        .order('order_date', { ascending: false });
        
    if (error) throw error;
    return data || [];
};

export const deleteSalesRecords = async (ids: string[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('인증이 만료되었습니다.');
    
    const { error } = await supabase.from('sales_records').delete().in('id', ids).eq('user_id', user.id);
    if (error) throw error;
    await logActivity(user.id, 'DELETE_SALES', `${ids.length}건의 매출 기록 삭제`);
};
