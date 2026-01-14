
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Zap, Award, Package, ShieldCheck, Sparkles, ExternalLink } from 'lucide-react';
import { fetchAppSettings, AppSettings, fetchAllTiers } from '../services/dbService';
import { Tier } from '../types';

export const Home: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHomeData = async () => {
        try {
            const [s, t] = await Promise.all([fetchAppSettings(), fetchAllTiers()]);
            setSettings(s);
            setTiers(t);
        } catch (e) {
            console.error("Home load error:", e);
        } finally {
            setLoading(false);
        }
    };
    loadHomeData();
  }, []);

  const handleSubClick = (url: string | undefined) => {
    if (url) {
      window.open(url, '_blank');
    } else {
      alert("구독 페이지가 아직 설정되지 않았습니다. 관리자에게 문의하세요.");
    }
  };

  // Find tier info safely
  const getTier = (id: string) => tiers.find(t => t.id === id) || { max_products: 0, max_templates: 0 };
  const freeTier = getTier('free');
  const silverTier = getTier('silver');
  const goldTier = getTier('gold');

  // Helper component to display price with optional discount
  const PriceDisplay = ({ original, sale }: { original?: string, sale?: string }) => {
      const orgPrice = Number(original || 0);
      const salePrice = Number(sale || 0);
      
      const hasDiscount = salePrice > 0 && salePrice < orgPrice;
      
      if (hasDiscount) {
          const discountRate = Math.round(((orgPrice - salePrice) / orgPrice) * 100);
          return (
              <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-slate-400 line-through">₩{orgPrice.toLocaleString()}</span>
                      <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{discountRate}% OFF</span>
                  </div>
                  <div className="text-3xl font-extrabold text-slate-900">
                      ₩{salePrice.toLocaleString()} <span className="text-base font-normal text-slate-400">/ 월</span>
                  </div>
              </div>
          );
      }
      
      return (
          <div className="text-3xl font-extrabold text-slate-900 mb-6 mt-6">
              ₩{orgPrice.toLocaleString()} <span className="text-base font-normal text-slate-400">/ 월</span>
          </div>
      );
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      <main className="flex-1">
        <div className="relative isolate pt-14 dark:bg-gray-900">
          <div className="py-24 sm:py-32 lg:pb-40">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
                  엑셀 주문서를<br/>
                  <span className="text-primary">3초 만에 송장으로.</span>
                </h1>
                <p className="mt-6 text-lg leading-8 text-slate-600">
                  복잡한 주문 리스트를 제품 ID 기반으로 자동 분류하고, 
                  각 택배사 양식에 맞춰 엑셀 파일을 생성해 드립니다.
                </p>
                <div className="mt-10 flex items-center justify-center gap-x-6">
                  <Link
                    to="/convert"
                    className="rounded-lg bg-primary px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary transition-all flex items-center gap-2"
                  >
                    무료로 시작하기 <ArrowRight size={16} />
                  </Link>
                  <Link to="/products" className="text-sm font-semibold leading-6 text-slate-900 hover:text-primary transition-colors">
                    제품 ID 등록하기 <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </div>
              
              <div className="mt-16 flow-root sm:mt-24">
                <div className="-m-2 rounded-xl bg-gray-900/5 p-2 ring-1 ring-inset ring-gray-900/10 lg:-m-4 lg:rounded-2xl lg:p-4">
                  <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
                     <div className="p-4 bg-blue-50 rounded-lg">
                        <div className="font-bold text-lg mb-2 text-blue-900 flex items-center gap-2"><Package size={20}/> 1. 파일 업로드</div>
                        <p className="text-sm text-slate-600 leading-relaxed">스마트스토어, 쿠팡 등에서 다운로드 받은 엑셀 주문서를 그대로 업로드하세요.</p>
                     </div>
                     <div className="p-4 bg-indigo-50 rounded-lg">
                        <div className="font-bold text-lg mb-2 text-indigo-900 flex items-center gap-2"><Zap size={20}/> 2. 자동 매핑</div>
                        <p className="text-sm text-slate-600 leading-relaxed">등록해둔 SKU(제품ID)를 기반으로 택배사 송장 양식을 자동 배정합니다.</p>
                     </div>
                     <div className="p-4 bg-green-50 rounded-lg">
                        <div className="font-bold text-lg mb-2 text-green-900 flex items-center gap-2"><Award size={20}/> 3. 결과 다운로드</div>
                        <p className="text-sm text-slate-600 leading-relaxed">택배사별로 분류된 결과 파일을 즉시 다운로드하여 송장 발행을 완료하세요.</p>
                     </div>
                  </div>
                </div>
              </div>

              {/* 멤버십 등급 설명 섹션 */}
              <div className="mt-32">
                <div className="text-center mb-12">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-bold mb-4 animate-bounce">
                    <Sparkles size={16}/> 하루 290원으로 발주서 스트레스 없이
                  </div>
                  <h2 className="text-3xl font-bold text-slate-900">멤버십 등급 안내</h2>
                  <p className="mt-4 text-slate-500">비즈니스 규모에 맞는 최적의 플랜을 선택하세요.</p>
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-100">
                    <ShieldCheck size={14}/> 신규 가입 시 실버 등급 3일 무료 체험 제공
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
                  {/* FREE */}
                  <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm flex flex-col hover:border-primary/30 transition-all group">
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-slate-900 mb-1">FREE (기본)</h3>
                      <p className="text-slate-500 text-sm">개인 판매자 및 소규모 운영</p>
                    </div>
                    <div className="text-3xl font-extrabold text-slate-900 mb-6 mt-6">₩0 <span className="text-base font-normal text-slate-400">/ 월</span></div>
                    <ul className="space-y-4 mb-8 flex-1">
                      <li className="flex items-start gap-3 text-sm text-slate-600"><CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0"/> 최대 제품 등록: {freeTier.max_products}개</li>
                      <li className="flex items-start gap-3 text-sm text-slate-600"><CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0"/> 송장 양식 등록: {freeTier.max_templates}개</li>
                      <li className="flex items-start gap-3 text-sm text-slate-600"><CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0"/> 기본 송장 변환 기능</li>
                    </ul>
                    <Link to="/auth" className="w-full py-3 px-4 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold text-center hover:bg-slate-200 transition-colors">현재 플랜</Link>
                  </div>

                  {/* SILVER */}
                  <div className="bg-white rounded-2xl p-8 border-2 border-primary shadow-xl shadow-primary/5 flex flex-col relative scale-105 z-10">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">가장 인기있는 플랜</div>
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-slate-900 mb-1">SILVER (실버)</h3>
                      <p className="text-slate-500 text-sm">성장하는 온라인 스토어 권장</p>
                    </div>
                    
                    <PriceDisplay 
                        original={settings?.price_silver_original} 
                        sale={settings?.price_silver_sale} 
                    />

                    <ul className="space-y-4 mb-8 flex-1">
                      <li className="flex items-start gap-3 text-sm text-slate-600"><CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0"/> 최대 제품 등록: {silverTier.max_products}개</li>
                      <li className="flex items-start gap-3 text-sm text-slate-600"><CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0"/> 송장 양식 등록: {silverTier.max_templates}개</li>
                      <li className="flex items-start gap-3 text-sm text-slate-600"><CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0"/> 무제한 송장 변환 및 압축 다운로드</li>
                      <li className="flex items-start gap-3 text-sm text-slate-600 font-bold text-primary"><CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0"/> 신규 가입 3일 체험권 적용</li>
                    </ul>
                    <button 
                      onClick={() => handleSubClick(settings?.silver_subscription_url)}
                      className="w-full py-3 px-4 bg-primary text-white rounded-lg text-sm font-bold text-center hover:bg-primary-hover transition-colors shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                    >
                      실버 플랜 시작하기 <ExternalLink size={14}/>
                    </button>
                  </div>

                  {/* GOLD */}
                  <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm flex flex-col hover:border-primary/30 transition-all group">
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-slate-900 mb-1">GOLD (골드)</h3>
                      <p className="text-slate-500 text-sm">대규모 쇼핑몰 및 물류 창고</p>
                    </div>

                    <PriceDisplay 
                        original={settings?.price_gold_original} 
                        sale={settings?.price_gold_sale} 
                    />

                    <ul className="space-y-4 mb-8 flex-1">
                      <li className="flex items-start gap-3 text-sm text-slate-600"><CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0"/> 최대 제품 등록: {goldTier.max_products}개</li>
                      <li className="flex items-start gap-3 text-sm text-slate-600"><CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0"/> 송장 양식 등록: {goldTier.max_templates}개</li>
                      <li className="flex items-start gap-3 text-sm text-slate-600"><CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0"/> 우선 순위 고객 지원</li>
                      <li className="flex items-start gap-3 text-sm text-slate-600 font-bold text-primary"><CheckCircle2 size={18} className="text-primary mt-0.5 shrink-0"/> 일괄 대량 제품 등록 지원</li>
                    </ul>
                    <button 
                      onClick={() => handleSubClick(settings?.gold_subscription_url)}
                      className="w-full py-3 px-4 bg-slate-100 text-slate-700 rounded-lg text-sm font-bold text-center hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                    >
                      골드 플랜 선택 <ExternalLink size={14}/>
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
