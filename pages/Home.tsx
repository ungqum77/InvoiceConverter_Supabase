
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
// Fixed: Added TrendingUp to the import list from lucide-react
import { ArrowRight, CheckCircle2, Sparkles, ExternalLink, BookOpen, HelpCircle, ChevronRight, FileSpreadsheet, Newspaper, MousePointer2, Zap, ShieldCheck, TrendingUp } from 'lucide-react';
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
        <div className="relative isolate pt-12 pb-24 sm:pt-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              {/* H1 Tag for SEO (애드센스 승인 핵심) */}
              <h1 className="text-[32px] font-[1000] tracking-tighter text-slate-900 sm:text-[56px] leading-[1.1] mb-8">
                무료 쇼핑몰 송장 변환기 - <br className="hidden sm:block"/>
                <span className="text-primary italic">쿠팡, 네이버 주문 엑셀 자동 변환</span>
              </h1>
              
              {/* Service Introduction (300+ chars for SEO) */}
              <div className="bg-slate-50 rounded-[32px] p-8 mb-12 border border-slate-200/60 text-left">
                <p className="text-slate-600 font-bold leading-relaxed text-base sm:text-lg">
                  송장.com은 스마트스토어, 쿠팡, 11번가, 지마켓 등 다양한 오픈마켓에서 다운로드한 엑셀 주문서를 클릭 한 번으로 CJ대한통운, 한진택배, 롯데택배 등 각 택배사 업로드 양식에 맞춰 자동 변환해주는 스마트 솔루션입니다. 엑셀 수식 작성이나 번거로운 복사/붙여넣기 작업 없이 업무 시간을 10배 이상 단축할 수 있습니다. 특히 SKU 매핑 기능을 통해 복잡한 세트 상품이나 사은품 포함 주문도 자동으로 분류하며, 모든 데이터 처리는 사용자의 브라우저 내에서 안전하게 수행되어 소중한 고객 개인정보가 서버에 저장되지 않습니다. 초보 셀러부터 베테랑 운영자까지 누구나 무료로 이용 가능한 국내 최고의 엑셀 송장 변환 서비스를 지금 바로 경험해 보세요.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-5 mb-20">
                <Link
                  to="/convert"
                  className="w-full sm:w-auto rounded-2xl bg-primary px-10 py-5 text-lg font-black text-white shadow-2xl shadow-primary/30 hover:bg-primary-hover transition-all flex items-center justify-center gap-2 hover:-translate-y-1"
                >
                  3초 만에 변환 시작하기 <ArrowRight size={20} />
                </Link>
                <Link to="/guides" className="text-sm font-black text-slate-700 hover:text-primary transition-colors flex items-center gap-2 p-3">
                  상세 사용방법 <HelpCircle size={18} className="opacity-40" />
                </Link>
              </div>
            </div>

            {/* 3-Step Section */}
            <section className="max-w-4xl mx-auto mb-32">
                <h2 className="text-2xl font-black text-slate-900 mb-10 text-center flex items-center justify-center gap-2">
                    🚀 3단계로 끝내는 송장 변환
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="flex-1 p-8 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-white hover:shadow-xl transition-all group">
                        <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-black mb-6 group-hover:scale-110 transition-transform">01</div>
                        <h3 className="font-black text-slate-900 text-lg mb-2">발주서 다운로드</h3>
                        <p className="text-slate-500 text-sm font-bold leading-relaxed">스마트스토어/쿠팡에서<br/>발주 엑셀을 다운로드하세요.</p>
                    </div>
                    <div className="flex-1 p-8 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-white hover:shadow-xl transition-all group">
                        <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-black mb-6 group-hover:scale-110 transition-transform">02</div>
                        <h3 className="font-black text-slate-900 text-lg mb-2">업로드 및 변환</h3>
                        <p className="text-slate-500 text-sm font-bold leading-relaxed">파일을 업로드하고<br/>택배사를 선택해 변환하세요.</p>
                    </div>
                    <div className="flex-1 p-8 bg-slate-50 border border-slate-100 rounded-3xl hover:bg-white hover:shadow-xl transition-all group">
                        <div className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center font-black mb-6 group-hover:scale-110 transition-transform">03</div>
                        <h3 className="font-black text-slate-900 text-lg mb-2">택배사 등록 완료</h3>
                        <p className="text-slate-500 text-sm font-bold leading-relaxed">변환된 파일을<br/>택배사 시스템에 등록하면 끝!</p>
                    </div>
                </div>
            </section>

            {/* Magazine & Tips Section */}
            <section className="max-w-4xl mx-auto mb-32">
                <div className="flex justify-between items-center mb-10">
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        💡 셀러를 위한 꿀팁 매거진
                    </h2>
                    <Link to="/blog" className="text-sm font-bold text-slate-400 hover:text-primary flex items-center gap-1">전체보기 <ChevronRight size={14}/></Link>
                </div>
                
                <div className="space-y-6">
                    <article className="bg-white border-b border-slate-100 pb-8 group">
                        <h3 className="text-xl font-bold mb-3">
                            <Link to="/blog" className="text-slate-900 group-hover:text-primary transition-colors">엑셀 지옥 탈출! 송장 입력 시간 10배 단축하기</Link>
                        </h3>
                        <p className="text-slate-500 line-height-relaxed text-sm font-medium">
                            아직도 엑셀 복사/붙여넣기로 야근하시나요? 수동 작업의 실수를 줄이고 업무 효율을 극대화하는 자동 변환기의 원리를 소개합니다. 수천 건의 주문 데이터도 단 3초 만에 정리하는 핵심 기술을 지금 확인해 보세요.
                        </p>
                    </article>

                    <article className="bg-white border-b border-slate-100 pb-8 group">
                        <h3 className="text-xl font-bold mb-3">
                            <Link to="/blog" className="text-slate-900 group-hover:text-primary transition-colors">CJ대한통운 vs 한진택배 엑셀 양식 완벽 비교</Link>
                        </h3>
                        <p className="text-slate-500 line-height-relaxed text-sm font-medium">
                            택배사마다 미묘하게 다른 엑셀 업로드 양식 때문에 '등록 실패'가 뜨셨나요? 각 택배사별 필수 입력값 차이와 가장 많이 발생하는 에러 유형 5가지를 완벽하게 정리해 드립니다.
                        </p>
                    </article>

                    <article className="bg-white pb-8 group">
                        <h3 className="text-xl font-bold mb-3">
                            <Link to="/blog" className="text-slate-900 group-hover:text-primary transition-colors">무료 변환기, 개인정보 유출 걱정되시나요?</Link>
                        </h3>
                        <p className="text-slate-500 line-height-relaxed text-sm font-medium">
                            내 고객의 소중한 정보가 서버에 남을까 봐 걱정되시나요? SONGJANG.COM이 사용하는 '서버리스' 기술의 안전성에 대해 설명해 드립니다. 모든 데이터 처리는 당신의 브라우저 안에서만 일어납니다.
                        </p>
                    </article>
                </div>
            </section>

            {/* Dynamic Content Section (Latest Blogs & Guides) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mb-32">
                {/* Latest Blog Posts */}
                <div className="bg-slate-50 rounded-[40px] p-10 border border-slate-200/60">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <Newspaper className="text-primary" size={20}/> 최신 블로그 소식
                        </h2>
                        <Link to="/blog" className="text-xs font-bold text-slate-400 hover:text-primary">더보기</Link>
                    </div>
                    <div className="space-y-4">
                        {posts.length > 0 ? posts.map(post => (
                            <Link to={`/blog/${post.slug}`} key={post.id} className="block bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-lg transition-all group">
                                <h3 className="font-bold text-slate-900 mb-2 group-hover:text-primary transition-colors line-clamp-1">{post.title}</h3>
                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium">
                                    {post.excerpt || post.content.replace(/<[^>]*>?/gm, '').slice(0, 100)}...
                                </p>
                            </Link>
                        )) : (
                            <div className="py-12 text-center text-slate-400 text-sm font-bold">등록된 블로그 글이 없습니다.</div>
                        )}
                    </div>
                </div>

                {/* Latest User Guides */}
                <div className="bg-slate-50 rounded-[40px] p-10 border border-slate-200/60">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <HelpCircle className="text-green-600" size={20}/> 서비스 사용설명서
                        </h2>
                        <Link to="/guides" className="text-xs font-bold text-slate-400 hover:text-primary">더보기</Link>
                    </div>
                    <div className="space-y-4">
                        {guides.length > 0 ? guides.map(guide => (
                            <Link to={`/guides/${guide.slug}`} key={guide.id} className="block bg-white p-6 rounded-2xl border border-slate-200 hover:shadow-lg transition-all group">
                                <div className="flex items-center gap-2 mb-2">
                                    <FileSpreadsheet size={14} className="text-green-600"/>
                                    <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors line-clamp-1">{guide.title}</h3>
                                </div>
                                <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium">
                                    {guide.excerpt || guide.content.replace(/<[^>]*>?/gm, '').slice(0, 100)}...
                                </p>
                            </Link>
                        )) : (
                            <div className="py-12 text-center text-slate-400 text-sm font-bold">등록된 사용 가이드가 없습니다.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Membership Pricing Section */}
            <div className="text-center pt-10">
                <div className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary/10 text-primary rounded-full text-[13px] font-black mb-6 border border-primary/20 shadow-lg shadow-primary/5">
                  <Sparkles size={16}/> 업무 효율을 위한 합리적인 멤버십
                </div>
                <h2 className="text-[36px] font-[1000] text-slate-900 sm:text-[48px] tracking-tighter leading-none">멤버십 등급 안내</h2>
                <p className="mt-5 text-slate-500 font-bold text-lg">성장하는 비즈니스 규모에 맞는 최적의 플랜을 확인해 보세요.</p>
                <div className="mt-6 inline-flex items-center gap-2 px-5 py-2 bg-amber-50 text-amber-700 text-xs font-black rounded-full border border-amber-200">
                  <ShieldCheck size={16}/> 신규 가입 시 실버 등급 3일 무료 체험 제공
                </div>

                <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto px-4 items-stretch text-left mb-24">
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
                        <button className="w-full py-5 bg-slate-50 text-slate-400 rounded-2xl text-sm font-black border border-slate-100 cursor-default">현재 기본 플랜</button>
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
