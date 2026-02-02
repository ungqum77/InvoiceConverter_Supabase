
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchUserGuideBySlug } from '../services/dbService';
import { UserGuide } from '../types';
import { ArrowLeft, Loader2, HelpCircle, Calendar, Share2 } from 'lucide-react';
import { marked } from 'marked';

export const UserGuidePage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [guide, setGuide] = useState<UserGuide | null>(null);
    const [loading, setLoading] = useState(true);
    const [htmlContent, setHtmlContent] = useState('');

    useEffect(() => {
        const load = async () => {
            if (slug) {
                try {
                    const data = await fetchUserGuideBySlug(slug);
                    setGuide(data);
                    if (data?.content) {
                        const parsed = marked.parse(data.content);
                        if (parsed instanceof Promise) {
                            parsed.then(str => setHtmlContent(str));
                        } else {
                            setHtmlContent(parsed as string);
                        }
                    }
                } catch (e) {
                    console.error(e);
                } finally {
                    setLoading(false);
                }
            }
        };
        load();
    }, [slug]);

    if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><Loader2 className="animate-spin text-primary" size={32}/></div>;
    if (!guide) return <div className="text-center py-20 text-slate-500">가이드를 찾을 수 없습니다.</div>;

    return (
        <article className="max-w-5xl mx-auto px-4 py-12">
            <Link to="/guides" className="inline-flex items-center text-sm text-slate-500 hover:text-primary mb-8 font-black transition-colors">
                <ArrowLeft size={16} className="mr-2"/> 가이드 목록으로
            </Link>

            {/* Thumbnail Header */}
            {guide.thumbnail_url && (
                <div className="w-full aspect-[21/9] mb-10 rounded-[40px] overflow-hidden shadow-2xl shadow-slate-200 border border-slate-100">
                    <img src={guide.thumbnail_url} className="w-full h-full object-cover" alt={guide.title} />
                </div>
            )}
            
            <header className="mb-10 bg-slate-50 p-8 rounded-[32px] border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 text-primary font-black text-xs mb-3 uppercase tracking-wider">
                    <HelpCircle size={18}/> 사용설명서
                </div>
                <h1 className="text-3xl md:text-4xl font-[1000] text-slate-900 leading-tight tracking-tighter">{guide.title}</h1>
                <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400 font-bold">
                    <Calendar size={14}/> 마지막 업데이트: {new Date(guide.updated_at || guide.created_at).toLocaleDateString()}
                </div>
            </header>

            <div className="flex flex-col lg:flex-row gap-12">
                <div className="flex-1 min-w-0">
                     <div 
                        className="prose prose-slate max-w-none 
                        prose-headings:font-black prose-headings:tracking-tighter
                        prose-headings:text-slate-900
                        prose-p:text-slate-600 prose-p:font-medium prose-p:leading-relaxed
                        prose-img:rounded-3xl prose-img:shadow-xl prose-img:mx-auto prose-img:border prose-img:border-slate-100
                        prose-strong:text-primary prose-strong:font-black
                        prose-li:text-slate-600 prose-li:font-medium
                        prose-code:bg-blue-50 prose-code:text-primary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none"
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                    />
                </div>
                
                {/* 우측 사이드바 */}
                <div className="w-full lg:w-72 shrink-0">
                    <div className="sticky top-24 space-y-6">
                        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow">
                            <h4 className="font-black text-slate-900 mb-3 text-sm flex items-center gap-2">
                                <Share2 size={16} className="text-primary"/> 가이드 공유
                            </h4>
                            <p className="text-xs text-slate-500 mb-4 font-medium leading-relaxed">이 가이드가 동료 셀러에게 도움이 될 것 같다면 링크를 공유해 보세요.</p>
                            <button 
                                onClick={() => {
                                    navigator.clipboard.writeText(window.location.href);
                                    alert("가이드 주소가 복사되었습니다.");
                                }}
                                className="w-full text-center py-2.5 bg-slate-50 hover:bg-primary hover:text-white text-slate-600 text-[11px] font-black rounded-xl transition-all border border-slate-100"
                            >
                                링크 주소 복사하기
                            </button>
                        </div>

                        <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6">
                            <h4 className="font-black text-primary mb-3 text-sm">도움이 필요하신가요?</h4>
                            <p className="text-xs text-slate-600 mb-4 font-medium leading-relaxed">설명서로 해결되지 않는 문제는 고객 지원팀에 문의해 주세요.</p>
                            <a href="mailto:ungqum77@gmail.com" className="block w-full text-center py-2.5 bg-primary text-white text-[11px] font-black rounded-xl hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all">문의 메일 보내기</a>
                        </div>
                    </div>
                </div>
            </div>
        </article>
    );
};
