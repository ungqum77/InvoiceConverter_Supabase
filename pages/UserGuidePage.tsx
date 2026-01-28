
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchUserGuideBySlug } from '../services/dbService';
import { UserGuide } from '../types';
import { ArrowLeft, Loader2, HelpCircle } from 'lucide-react';
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
        <article className="max-w-4xl mx-auto px-4 py-12">
            <Link to="/guides" className="inline-flex items-center text-sm text-slate-500 hover:text-primary mb-8 font-bold transition-colors">
                <ArrowLeft size={16} className="mr-2"/> 가이드 목록으로
            </Link>
            
            <header className="mb-10 bg-slate-50 p-8 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2 text-primary font-bold text-sm mb-3">
                    <HelpCircle size={18}/> 사용설명서
                </div>
                <h1 className="text-3xl font-black text-slate-900 leading-tight">{guide.title}</h1>
            </header>

            <div className="flex flex-col lg:flex-row gap-10">
                <div className="flex-1 min-w-0">
                     <div 
                        className="prose prose-slate max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:underline prose-img:rounded-xl prose-img:shadow-lg prose-strong:text-indigo-600 prose-strong:font-black"
                        dangerouslySetInnerHTML={{ __html: htmlContent }}
                    />
                </div>
                
                {/* 우측 사이드바 (도움말 위젯 등) */}
                <div className="w-full lg:w-64 shrink-0 space-y-6">
                    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm sticky top-24">
                        <h4 className="font-bold text-slate-900 mb-3 text-sm">도움이 필요하신가요?</h4>
                        <p className="text-xs text-slate-500 mb-4">설명서로 해결되지 않는 문제는 관리자에게 직접 문의해주세요.</p>
                        <a href="mailto:ungqum77@gmail.com" className="block w-full text-center py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition-colors">문의하기</a>
                    </div>
                </div>
            </div>
        </article>
    );
};
