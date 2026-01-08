
import { supabase } from './supabase';
import { Product, InvoiceTemplate, UserProfile, Tier, ActivityLog } from '../types';

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
});

const mapTemplateFromDB = (data: any): InvoiceTemplate => ({
  id: data.id,
  name: data.name,
  headers: data.headers, 
  user_id: data.user_id,
});

// Tier Definitions - 무료 등급 수치 조정 (2/1)
export const DEFAULT_TIERS: Record<string, Tier> = {
  free: { id: 'free', name: '무료 회원', max_products: 2, max_templates: 1 },
  silver: { id: 'silver', name: '실버 회원', max_products: 8, max_templates: 3 },
  gold: { id: 'gold', name: '골드 회원', max_products: 100, max_templates: 50 },
  admin: { id: 'admin', name: '관리자', max_products: 9999, max_templates: 9999 },
};

export const fetchAllTiers = async (): Promise<Tier[]> => {
    if (supabase) {
        try {
            const { data, error } = await supabase.from('tiers').select('*').order('max_products', { ascending: true });
            if (error) throw error;
            return data || Object.values(DEFAULT_TIERS);
        } catch (e) {
            return Object.values(DEFAULT_TIERS);
        }
    }
    return Object.values(DEFAULT_TIERS);
};

// --- App Settings (URLs) ---
export interface AppSettings {
    silver_subscription_url: string;
    gold_subscription_url: string;
    youtube_tutorial_template: string;
    youtube_tutorial_product: string;
    youtube_tutorial_convert: string;
}

export const SETTING_KEYS: (keyof AppSettings)[] = [
    'silver_subscription_url',
    'gold_subscription_url',
    'youtube_tutorial_template',
    'youtube_tutorial_product',
    'youtube_tutorial_convert'
];

export const fetchAppSettings = async (): Promise<AppSettings> => {
    const defaults: AppSettings = {
        silver_subscription_url: '',
        gold_subscription_url: '',
        youtube_tutorial_template: '',
        youtube_tutorial_product: '',
        youtube_tutorial_convert: ''
    };

    if (!supabase) {
        return JSON.parse(localStorage.getItem('demo_settings') || JSON.stringify(defaults));
    }

    try {
        const { data, error } = await supabase.from('app_settings').select('*');
        if (error) throw error;
        
        const settings: any = { ...defaults };
        if (data) {
            data.forEach((row: any) => {
                if (SETTING_KEYS.includes(row.key)) {
                    settings[row.key] = row.value || '';
                }
            });
        }
        return settings;
    } catch (e) {
        console.warn("Settings fetch failed, returning defaults:", e);
        return defaults;
    }
};

export const updateAppSettings = async (settings: AppSettings) => {
    const payload = SETTING_KEYS.map(key => ({
        key: key,
        value: settings[key] ? String(settings[key]).trim() : ''
    }));

    if (supabase) {
        const { error } = await supabase
            .from('app_settings')
            .upsert(payload, { onConflict: 'key' });
        
        if (error) {
            console.error("Supabase Upsert Error:", error);
            throw new Error(`저장 실패 (${error.code}): ${error.message}`);
        }
    } else {
        localStorage.setItem('demo_settings', JSON.stringify(settings));
    }
};

// --- Activity Logs ---
export const logActivity = async (userId: string, actionType: string, description: string) => {
  if (supabase) {
    try {
      await supabase.from('activity_logs').insert({ user_id: userId, action_type: actionType, description: description });
    } catch (e) {
      console.error("Logging failed:", e);
    }
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
        const effectiveTier = data.tier || DEFAULT_TIERS[data.tier_id] || DEFAULT_TIERS['free'];
        return { ...data, tier: effectiveTier };
    } catch (e) {
        return { id: userId, email: '', tier_id: 'free', role: 'user', tier: DEFAULT_TIERS['free'] };
    }
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
    if (supabase) {
        const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
        if (error) throw error;
    } else {
        console.log("Demo mode: Update user profile", userId, updates);
    }
};

export const getUsageStats = async (userId: string) => {
  if (supabase) {
    try {
      const { count: productCount } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      const { count: templateCount } = await supabase.from('invoice_templates').select('*', { count: 'exact', head: true }).eq('user_id', userId);
      return { productCount: productCount || 0, templateCount: templateCount || 0 };
    } catch (e) {
      return { productCount: 0, templateCount: 0 };
    }
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
  const { data, error } = await supabase.from('invoice_templates').insert({ user_id: user.id, name: template.name, headers: template.headers }).select().single();
  if (error) throw error;
  await logActivity(user.id, 'CREATE_TEMPLATE', `송장 양식 '${template.name}' 생성`);
  return mapTemplateFromDB(data);
};

export const deleteTemplate = async (id: string): Promise<void> => {
  if (supabase) await supabase.from('invoice_templates').delete().eq('id', id);
};

// --- Products ---
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
  const { data, error } = await supabase.from('products').insert({ user_id: user.id, sku: product.sku, name: product.name, additional_name: product.additionalName, use_additional_name: product.useAdditionalName, supplier_name: product.supplierName, template_id: product.templateId }).select().single();
  if (error) throw error;
  await logActivity(user.id, 'CREATE_PRODUCT', `제품 '${product.sku}' 등록`);
  return mapProductFromDB(data);
};

export const createProductsBulk = async (products: Omit<Product, 'id' | 'user_id'>[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('인증이 만료되었습니다.');
    const payload = products.map(p => ({ user_id: user.id, sku: p.sku, name: p.name, additional_name: p.additionalName, use_additional_name: p.useAdditionalName, supplier_name: p.supplierName, template_id: p.templateId }));
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

    const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return mapProductFromDB(data);
};

export const deleteProduct = async (id: string): Promise<void> => {
  if (supabase) await supabase.from('products').delete().eq('id', id);
};
