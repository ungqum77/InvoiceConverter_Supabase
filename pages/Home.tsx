
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Zap, Award, Package, ShieldCheck, Sparkles, ExternalLink, TrendingUp, BookOpen, HelpCircle, ChevronRight, FileSpreadsheet, MousePointer2 } from 'lucide-react';
import { fetchAppSettings, AppSettings, fetchAllTiers, trackEvent, fetchBlogPosts, fetchUserGuides } from '../services/dbService';
import { Tier, BlogPost, UserGuide } from '../types';

export const Home: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [guides, setGuides] = useState<UserGuide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHomeData = async () => {
        setLoading(true);
        try {
            const [s, t, b, g] = await Promise.all([
                fetchAppSettings(), 
                fetchAllTiers(),
                fetchBlogPosts(),
                fetchUserGuides()
            ]);
            setSettings(s);
            setTiers(t);
            setPosts(b.slice(0, 5)); // 최신 5개
            setGuides(g.slice(0, 5)); // 최신 5개
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };
    loadHomeData();
  }, []);

  const getTier = (id: string) => tiers.find(t => t.id === id) || { max_products: 0, max_templates: 0, max_crm_count: 0 };
  const silverTier = getTier('silver');
  const goldTier = getTier('gold');
  const freeTier = getTier('free');

  const handleSubscriptionClick = (tier: string, url: string) => {
      trackEvent('click_subscription', { tier_id: tier });
      if (url) window.open(url, '_blank');
      else alert("준비 중입니다.");
  };

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
        {/* Hero Section */}
        <div className="relative isolate pt-16 pb-24">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <h1 className="text-[36px] font-[1000] tracking-tighter text-slate-900 sm:text-[60px] leading-[1.1] mb-8">
                무료 쇼핑몰 송장 변환기 - <br className="hidden sm:block"/>
                <span className="text-primary italic">쿠팡, 네이버 주문 엑셀 자동 변환</span>
              </h1>
              
              <div className="bg-primary/5 rounded-3xl p-8 mb-12 border border-primary/10 text-left sm:text-center">
                <p className="text-slate-600 font-bold leading-relaxed text-base sm:text-lg">
                  송장.com은 스마트스토어, 쿠팡, 11번가 등 다양한 오픈마켓의 엑셀 주문서를 클릭 한 번으로 각 택배사(CJ대한통운, 한진, 롯데 등) 양식에 맞춰 자동 변환해주는 무료 온라인 도구입니다. 복잡한 엑셀 수식이나 복사/붙여넣기 없이 업무 시간을 획기적으로 단축할 수 있습니다. SKU 매핑 기능을 통해 세트 상품이나 사은품 관리도 자동화하며, 강력한 보안 기술을 적용하여 소중한 고객의 개인정보가 서버에 저장되지 않고 안전하게 처리됩니다. 지금 바로 회원가입 없이 변환 기능을 체험해보고, 효율적인 쇼핑몰 운영을 시작하세요.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
                <Link
                  to="/convert"
                  className="w-full sm:w-auto rounded-2xl bg-primary px-10 py-5 text-lg font-black text-white shadow-2xl shadow-primary/30 hover:bg-primary-hover transition-all flex items-center justify-center gap-2 hover:-translate-y-1"
                >
                  3초 만에 변환 시작하기 <ArrowRight size={20} />
                </Link>
                <Link to="/guides" className="text-sm font-black text-slate-700 hover:text-primary transition-colors flex items-center gap-2 p-3">
                  사용방법 알아보기 <HelpCircle size={18} className="opacity-40" />
                </Link>
              </div>
            </div>

            {/* 3-Step Guide Section (Updated with user request) */}
            <div className="mt-24 max-w-5xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mb-10 text-center flex items-center justify-center gap-3">
                <Sparkles className="text-amber-500" /> 🚀 3단계로 끝내는 송장 변환
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-50 border border-slate-100 p-8 rounded-[32px] text-center group hover:bg-white hover:shadow-xl transition-all hover:-translate-y-2">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-primary shadow-sm border border-slate-100 mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <span className="font-black">01</span>
                  </div>
                  <h3 className="font-black text-xl text-slate-900 mb-3">발주 엑셀 다운로드</h3>
                  <p className="text-sm text-slate-500 leading-relaxed font-bold">스마트스토어/쿠팡 관리자 페이지에서<br/>오늘의 발주 엑셀을 다운로드하세요.</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-8 rounded-[32px] text-center group hover:bg-white hover:shadow-xl transition-all hover:-translate-y-2">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-slate-100 mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <span className="font-black">02</span>
                  </div>
                  <h3 className="font-black text-xl text-slate-900 mb-3">파일 업로드 및 변환</h3>
                  <p className="text-sm text-slate-500 leading-relaxed font-bold">송장.com에 파일을 업로드하고<br/>택배사 양식을 선택해 즉시 변환하세요.</p>
                </div>
                <div className="bg-slate-50 border border-slate-100 p-8 rounded-[32px] text-center group hover:bg-white hover:shadow-xl transition-all hover:-translate-y-2">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-green-600 shadow-sm border border-slate-100 mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <span className="font-black">03</span>
                  </div>
                  <h3 className="font-black text-xl text-slate-900 mb-3">택배사 시스템 등록</h3>
                  <p className="text-sm text-slate-500 leading-relaxed font-bold">변환된 파일을 CJ/한진/롯데 등<br/>택배사 시스템에 등록하면 끝!</p>
                </div>
              </div>
            </div>

            {/* Blog & Guide Snippets Section */}
            <div className="mt-40 grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Blog Posts */}
              <div>
                <div className="flex justify-between items-end mb-8">
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                    <BookOpen className="text-primary"/> 💡 셀러를 위한 꿀팁 매거진
                  </h2>
                  <Link to="/blog" className="text-sm font-bold text-slate-400 hover:text-primary flex items-center">더보기 <ChevronRight size={16}/></Link>
                </div>
                <div className="space-y-4">
                  {posts.length > 0 ? posts.map(post => (
                    <Link to={`/blog/${post.slug}`} key={post.id} className="block bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-md transition-all group">
                      <h3 className="font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors line-clamp-1">{post.title}</h3>
                      <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed">{post.excerpt || post.content.replace(/<[^>]*>?/gm, '').slice(0, 100)}...</p>
                    </Link>
                  )) : (
                    <div className="text-sm text-slate-400 p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">등록된 블로그가 없습니다.</div>
                  )}
                  {/* Static Content for SEO as requested */}
                  <div className="pt-4 space-y-4 border-t border-slate-100">
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <h4 className="text-sm font-bold text-slate-800 mb-1">엑셀 지옥 탈출! 송장 입력 시간 10배 단축하기</h4>
                      <p className="text-xs text-slate-500">아직도 엑셀 복사/붙여넣기로 야근하시나요? 수동 작업의 실수를 줄이고 업무 효율을 극대화하는 자동 변환기의 원리를 소개합니다.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* User Guides */}
              <div>
                <div className="flex justify-between items-end mb-8">
                  <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                    <HelpCircle className="text-green-600"/> 📖 서비스 사용설명서
                  </h2>
                  <Link to="/guides" className="text-sm font-bold text-slate-400 hover:text-primary flex items-center">더보기 <ChevronRight size={16}/></Link>
                </div>
                <div className="space-y-4">
                  {guides.length > 0 ? guides.map(guide => (
                    <Link to={`/guides/${guide.slug}`} key={guide.id} className="block bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-md transition-all group">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-600"><FileSpreadsheet size={16}/></div>
                        <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-1">{guide.title}</h3>
                      </div>
                      <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed ml-11">{guide.excerpt || guide.content.replace(/<[^>]*>?/gm, '').slice(0, 100)}...</p>
                    </Link>
                  )) : (
                    <div className="text-sm text-slate-400 p-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">등록된 가이드가 없습니다.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Membership Pricing Section */}
            <div className="mt-40 text-center">
                <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/10 text-primary rounded-full text-[13px] font-black mb-6 border border-primary/20 animate-pulse shadow-lg shadow-primary/5">
                  <Sparkles size={16}/> 하루 290원으로 발주서 스트레스 없이
                </div>
                <h2 className="text-[40px] font-[1000] text-slate-900 sm:text-[50px] tracking-tighter leading-none">멤버십 등급 안내</h2>
                <p className="mt-5 text-slate-500 font-bold text-lg">비즈니스 규모에 맞는 최적의 플랜을 선택하세요.</p>
                <div className="mt-6 inline-flex items-center gap-2 px-5 py-2 bg-amber-50 text-amber-700 text-xs font-black rounded-full border border-amber-200 shadow-sm">
                  <ShieldCheck size={16}/> 신규 가입 시 실버 등급 3일 무료 체험 제공
                </div>

                <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto px-4 items-stretch text-left">
                    {/* FREE */}
                    <div className="bg-white rounded-[40px] p-10 border border-slate-200 shadow-sm flex flex-col hover:shadow-xl transition-all">
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
                    <div className="bg-white rounded-[40px] p-10 border-[4px] border-primary shadow-2xl shadow-primary/20 flex flex-col relative sm:scale-105 z-10 overflow-hidden">
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
                            onClick={() => handleSubscriptionClick('silver', settings?.silver_subscription_url || '')}
                            className="w-full py-5 bg-primary text-white rounded-2xl text-base font-[1000] shadow-xl shadow-primary/30 flex items-center justify-center gap-2 hover:bg-primary-hover transition-all"
                        >
                            실버 플랜 시작하기 <ExternalLink size={20}/>
                        </button>
                    </div>

                    {/* GOLD */}
                    <div className="bg-white rounded-[40px] p-10 border border-slate-200 shadow-sm flex flex-col hover:shadow-xl transition-all">
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
                            onClick={() => handleSubscriptionClick('gold', settings?.gold_subscription_url || '')}
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
