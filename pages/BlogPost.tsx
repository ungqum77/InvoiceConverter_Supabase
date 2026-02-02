
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchBlogPostBySlug } from '../services/dbService';
import { BlogPost } from '../types';
import { ArrowLeft, Calendar, Loader2, Share2, ImageIcon } from 'lucide-react';
import { marked } from 'marked';

export const BlogPostPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [post, setPost] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(true);
    const [htmlContent, setHtmlContent] = useState('');

    useEffect(() => {
        const load = async () => {
            if (slug) {
                try {
                    const data = await fetchBlogPostBySlug(slug);
                    setPost(data);
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

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: post?.title,
                url: window.location.href
            });
        } else {
            navigator.clipboard.writeText(window.location.href);
            alert("URL이 복사되었습니다.");
        }
    };

    if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><Loader2 className="animate-spin text-primary" size={32}/></div>;
    if (!post) return <div className="text-center py-20 text-slate-500">글을 찾을 수 없습니다.</div>;

    return (
        <article className="max-w-3xl mx-auto px-4 py-12">
            <Link to="/blog" className="inline-flex items-center text-sm text-slate-500 hover:text-primary mb-8 font-bold transition-colors">
                <ArrowLeft size={16} className="mr-2"/> 목록으로 돌아가기
            </Link>
            
            {/* Thumbnail Header */}
            {post.thumbnail_url && (
                <div className="w-full aspect-[21/9] mb-10 rounded-[32px] overflow-hidden shadow-2xl shadow-slate-200 border border-slate-100">
                    <img src={post.thumbnail_url} className="w-full h-full object-cover" alt={post.title} />
                </div>
            )}

            <header className="mb-10">
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 leading-tight">{post.title}</h1>
                <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1.5 font-bold"><Calendar size={16} className="text-primary"/> {new Date(post.created_at).toLocaleDateString()}</div>
                        <span className="opacity-30">|</span>
                        <span className="font-medium text-slate-400">송장.com 테크 인사이트</span>
                    </div>
                    <button onClick={handleShare} className="p-2.5 hover:bg-slate-50 rounded-full text-slate-400 hover:text-primary transition-all">
                        <Share2 size={20}/>
                    </button>
                </div>
            </header>

            {/* Content with Enhanced Image Styles */}
            <div 
                className="prose prose-slate max-w-none 
                prose-headings:font-black prose-headings:tracking-tighter prose-headings:text-slate-900
                prose-p:text-slate-600 prose-p:leading-relaxed prose-p:font-medium
                prose-a:text-primary prose-a:font-black hover:prose-a:underline
                prose-img:rounded-3xl prose-img:shadow-xl prose-img:mx-auto prose-img:border prose-img:border-slate-100
                prose-strong:text-indigo-600 prose-strong:font-black
                prose-code:text-primary prose-code:bg-blue-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none"
                dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
            
            <div className="mt-16 pt-8 border-t border-slate-200">
                <div className="bg-slate-50 p-8 rounded-3xl flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left border border-slate-100">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/50">
                        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center text-white font-[1000] text-xl shadow-lg shadow-primary/20">S</div>
                    </div>
                    <div className="flex-1">
                        <h3 className="font-black text-slate-900 mb-1 text-lg tracking-tight">송장.com으로 업무 시간을 단축하세요</h3>
                        <p className="text-sm text-slate-500 mb-4 font-medium">복잡한 엑셀 주문서를 단 3초 만에 변환해 드립니다.</p>
                        <Link to="/" className="inline-block px-6 py-3 bg-primary text-white text-sm font-black rounded-xl hover:bg-primary-hover transition-all shadow-lg shadow-primary/20">지금 바로 시작하기</Link>
                    </div>
                </div>
            </div>
        </article>
    );
};
