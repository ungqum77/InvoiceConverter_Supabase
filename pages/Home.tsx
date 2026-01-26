
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Zap, Award, Package, ShieldCheck, Sparkles, ExternalLink, TrendingUp } from 'lucide-react';
import { fetchAppSettings, AppSettings, fetchAllTiers } from '../services/dbService';
import { Tier } from '../types';

export const Home: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHomeData = async () => {
        setLoading(true);
        try {
            const [s, t] = await Promise.all([fetchAppSettings(), fetchAllTiers()]);
            setSettings(s);
            setTiers(t);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    loadHomeData();
  }, []);

  const getTier = (id: string) => tiers.find(t => t.id === id) || { max_products: 0, max_templates: 0, max_crm_count: 0 };
  const silverTier = getTier('silver');
  const goldTier = getTier('gold');
  const freeTier = getTier('free');

  const PriceBox = ({ original, sale, tierId }: { original?: string, sale?: string, tierId: string }) => {
    if (loading) return <div className="h-20 w-32 bg-slate-100 animate-pulse rounded-xl mb-6"></div>;
    
    const org = Number(original || 0);
    const sl = Number(sale || 0);
    const hasDiscount = org > sl && sl > 0;
    const discountRate = hasDiscount ? Math.round(((org - sl) / org) * 100) : 0;

    return (
        <div className="mb-8 min-h-[100px] flex flex-col justify-center">
            {hasDiscount && (
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm text-slate-300 line-through font-bold">₩{org.toLocaleString()}</span>
                    <span className="bg-red-50 text-red-500 text-[10px] font-[900] px-2 py-0.5 rounded-md border border-red-100 uppercase tracking-tighter">{discountRate}% OFF</span>
                </div>
            )}
            <div className="flex items-baseline gap-1">
                <span className="text-4xl font-[1000] text-slate-900 tracking-tighter">₩{sl.toLocaleString()}</span>
                <span className="text-slate-400 text-sm font-bold">/ 30일</span>
            </div>
        </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-white overflow-x-hidden">
      <main className="flex-1">
        <div className="relative isolate pt-16 pb-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-[44px] font-[1000] tracking-tighter text-slate-900 sm:text-[68px] leading-[1.05] mb-8">
                엑셀 주문서를<br/>
                <span className="text-primary italic">3초 만에 송장으로.</span>
              </h1>
              <p className="text-slate-500 font-bold max-w-2xl mx-auto mb-12 text-lg">
                복잡한 주문 리스트를 제품 ID 기반으로 자동 분류하고,<br className="hidden sm:block"/> 각 택배사 양식에 맞춰 엑셀 파일을 즉시 생성해 드립니다.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
                <Link
                  to="/convert"
                  className="w-full sm:w-auto rounded-2xl bg-primary px-10 py-5 text-lg font-black text-white shadow-2xl shadow-primary/30 hover:bg-primary-hover transition-all flex items-center justify-center gap-2 hover:-translate-y-1"
                >
                  무료로 시작하기 <ArrowRight size={20} />
                </Link>
                <Link to="/products" className="text-sm font-black text-slate-700 hover:text-primary transition-colors flex items-center gap-2 p-3">
                  제품 ID 등록하기 <ArrowRight size={16} className="opacity-40" />
                </Link>
              </div>
            </div>
            
            <div className="mt-24">
              <div className="bg-white rounded-[40px] shadow-[0_30px_70px_rgba(0,0,0,0.06)] border border-slate-100 p-10 md:p-14 grid grid-cols-1 md:grid-cols-3 gap-12 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                  
                  <div className="space-y-4 relative">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-primary shadow-sm border border-blue-100"><Package size={28} strokeWidth={2.5}/></div>
                    <h3 className="font-black text-2xl text-slate-900 tracking-tight">1. 파일 업로드</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-bold">스마트스토어, 쿠팡 등에서 다운로드 받은 엑셀 주문서를 그대로 업로드하세요.</p>
                  </div>
                  <div className="space-y-4 relative">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100"><Zap size={28} strokeWidth={2.5}/></div>
                    <h3 className="font-black text-2xl text-slate-900 tracking-tight">2. 자동 매핑</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-bold">등록해둔 SKU(제품ID)를 기반으로 택배사 송장 양식을 자동 배정합니다.</p>
                  </div>
                  <div className="space-y-4 relative">
                    <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 shadow-sm border border-green-100"><Award size={28} strokeWidth={2.5}/></div>
                    <h3 className="font-black text-2xl text-slate-900 tracking-tight">3. 결과 다운로드</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-bold">택배사별로 분류된 결과 파일을 즉시 다운로드하여 송장 발행을 완료하세요.</p>
                  </div>
              </div>
            </div>

            {/* 멤버십 등급 섹션 */}
            <div className="mt-40 text-center">
                <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/10 text-primary rounded-full text-[13px] font-black mb-6 border border-primary/20 animate-pulse shadow-lg shadow-primary/5">
                  <Sparkles size={16}/> 하루 290원으로 발주서 스트레스 없이
                </div>
                <h2 className="text-[40px] font-[1000] text-slate-900 sm:text-[50px] tracking-tighter leading-none">멤버십 등급 안내</h2>
                <p className="mt-5 text-slate-500 font-bold text-lg">비즈니스 규모에 맞는 최적의 플랜을 선택하세요.</p>
                <div className="mt-6 inline-flex items-center gap-2 px-5 py-2 bg-amber-50 text-amber-700 text-xs font-black rounded-full border border-amber-200 shadow-sm">
                  <ShieldCheck size={16}/> 신규 가입 시 실버 등급 3일 무료 체험 제공
                </div>

                <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto px-4 items-stretch">
                    {/* FREE */}
                    <div className="bg-white rounded-[40px] p-10 border border-slate-200 shadow-sm flex flex-col text-left hover:shadow-xl transition-all">
                        <div className="mb-6">
                            <h3 className="text-xl font-[1000] text-slate-900">FREE (기본)</h3>
                            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">개인 판매자 및 소규모 운영</p>
                        </div>
                        <div className="text-4xl font-[1000] text-slate-900 mb-8 min-h-[100px] flex items-center tracking-tighter">
                            ₩0<span className="text-sm font-normal text-slate-400 ml-1">/ 30일</span>
                        </div>
                        <ul className="space-y-5 mb-12 flex-1 border-t border-slate-50 pt-8">
                            <li className="flex items-center gap-4 text-sm font-bold text-slate-600"><CheckCircle2 size={20} className="text-primary shrink-0"/> 최대 제품 등록: {freeTier.max_products}개</li>
                            <li className="flex items-center gap-4 text-sm font-bold text-slate-600"><CheckCircle2 size={20} className="text-primary shrink-0"/> 송장 양식 등록: {freeTier.max_templates}개</li>
                            <li className="flex items-center gap-4 text-sm font-bold text-slate-600"><TrendingUp size={20} className="text-primary shrink-0"/> CRM 주문 저장: {(freeTier.max_crm_count ?? 20) >= 99999 ? '무제한' : `${(freeTier.max_crm_count ?? 20).toLocaleString()}건`}</li>
                            <li className="flex items-center gap-4 text-sm font-bold text-slate-600"><CheckCircle2 size={20} className="text-primary shrink-0"/> 기본 송장 변환 기능</li>
                        </ul>
                        <button className="w-full py-5 bg-slate-50 text-slate-400 rounded-2xl text-sm font-black border border-slate-100 cursor-default">현재 플랜</button>
                    </div>

                    {/* SILVER */}
                    <div className="bg-white rounded-[40px] p-10 border-[4px] border-primary shadow-2xl shadow-primary/20 flex flex-col relative sm:scale-105 z-10 text-left overflow-hidden">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-primary text-white text-[11px] font-[1000] px-6 py-2 rounded-b-2xl uppercase tracking-tighter shadow-md">가장 인기있는 플랜</div>
                        
                        <div className="mb-6 pt-6">
                            <h3 className="text-xl font-[1000] text-slate-900">SILVER (실버)</h3>
                            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">성장하는 온라인 스토어 권장</p>
                        </div>
                        
                        <PriceBox 
                            original={settings?.price_silver_original || "11000"} 
                            sale={settings?.price_silver_sale || "5500"} 
                            tierId="silver"
                        />

                        <ul className="space-y-5 mb-12 flex-1 border-t border-slate-50 pt-8">
                            <li className="flex items-center gap-4 text-sm font-bold text-slate-800"><CheckCircle2 size={20} className="text-primary shrink-0"/> 최대 제품 등록: {silverTier.max_products}개</li>
                            <li className="flex items-center gap-4 text-sm font-bold text-slate-800"><CheckCircle2 size={20} className="text-primary shrink-0"/> 송장 양식 등록: {silverTier.max_templates}개</li>
                            <li className="flex items-center gap-4 text-sm font-bold text-slate-800"><TrendingUp size={20} className="text-primary shrink-0"/> CRM 주문 저장: {(silverTier.max_crm_count ?? 300) >= 99999 ? '무제한' : `${(silverTier.max_crm_count ?? 300).toLocaleString()}건`}</li>
                            <li className="flex items-center gap-4 text-sm font-bold text-slate-800"><CheckCircle2 size={20} className="text-primary shrink-0"/> 무제한 송장 변환 및 압축 다운로드</li>
                            <li className="flex items-center gap-4 text-sm font-[1000] text-primary italic"><CheckCircle2 size={20} className="text-primary shrink-0"/> 신규 가입 3일 체험권 적용</li>
                        </ul>
                        
                        <button 
                            onClick={() => window.open(settings?.silver_subscription_url, '_blank')}
                            className="w-full py-5 bg-primary text-white rounded-2xl text-base font-[1000] shadow-xl shadow-primary/30 flex items-center justify-center gap-2 hover:bg-primary-hover transition-all"
                        >
                            실버 플랜 시작하기 <ExternalLink size={20}/>
                        </button>
                    </div>

                    {/* GOLD */}
                    <div className="bg-white rounded-[40px] p-10 border border-slate-200 shadow-sm flex flex-col text-left hover:shadow-xl transition-all">
                        <div className="mb-6">
                            <h3 className="text-xl font-[1000] text-slate-900">GOLD (골드)</h3>
                            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mt-1">대규모 쇼핑몰 및 물류 창고</p>
                        </div>

                        <PriceBox 
                            original={settings?.price_gold_original || "15000"} 
                            sale={settings?.price_gold_sale || "8800"} 
                            tierId="gold"
                        />

                        <ul className="space-y-5 mb-12 flex-1 border-t border-slate-50 pt-8">
                            <li className="flex items-center gap-4 text-sm font-bold text-slate-600"><CheckCircle2 size={20} className="text-primary shrink-0"/> 최대 제품 등록: {goldTier.max_products}개</li>
                            <li className="flex items-center gap-4 text-sm font-bold text-slate-600"><CheckCircle2 size={20} className="text-primary shrink-0"/> 송장 양식 등록: {goldTier.max_templates}개</li>
                            <li className="flex items-center gap-4 text-sm font-bold text-slate-600"><TrendingUp size={20} className="text-primary shrink-0"/> CRM 주문 저장: 무제한</li>
                            <li className="flex items-center gap-4 text-sm font-bold text-slate-600"><CheckCircle2 size={20} className="text-primary shrink-0"/> 우선 순위 고객 지원</li>
                            <li className="flex items-center gap-4 text-sm font-bold text-slate-600"><CheckCircle2 size={20} className="text-primary shrink-0"/> 일괄 대량 제품 등록 지원</li>
                        </ul>
                        <button 
                            onClick={() => window.open(settings?.gold_subscription_url, '_blank')}
                            className="w-full py-5 bg-slate-900 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-xl shadow-slate-200"
                        >
                            골드 플랜 선택 <ExternalLink size={18}/>
                        </button>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
