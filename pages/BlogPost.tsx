import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchBlogPostBySlug } from '../services/dbService';
import { BlogPost } from '../types';
import { ArrowLeft, Calendar, Loader2, Share2 } from 'lucide-react';

export const BlogPostPage: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const [post, setPost] = useState<BlogPost | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            if (slug) {
                try {
                    const data = await fetchBlogPostBySlug(slug);
                    setPost(data);
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
            
            <header className="mb-10">
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-4 leading-tight">{post.title}</h1>
                <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1.5"><Calendar size={16}/> {new Date(post.created_at).toLocaleDateString()}</div>
                        <span>·</span>
                        <span>송장.com 팀</span>
                    </div>
                    <button onClick={handleShare} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-primary transition-colors">
                        <Share2 size={20}/>
                    </button>
                </div>
            </header>

            <div 
                className="prose prose-slate max-w-none prose-headings:font-bold prose-a:text-primary hover:prose-a:underline prose-img:rounded-xl"
                dangerouslySetInnerHTML={{ __html: post.content }}
            />
            
            <div className="mt-16 pt-8 border-t border-slate-200">
                <div className="bg-slate-50 p-6 rounded-2xl flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                    <div className="bg-white p-3 rounded-xl shadow-sm">
                        <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center text-white font-black text-xl">S</div>
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 mb-1">송장.com으로 업무 시간을 단축하세요</h3>
                        <p className="text-sm text-slate-500 mb-4">복잡한 엑셀 주문서를 클릭 한 번으로 변환해 드립니다.</p>
                        <Link to="/" className="inline-block px-5 py-2.5 bg-slate-900 text-white text-sm font-bold rounded-xl hover:bg-slate-800 transition-colors">무료로 시작하기</Link>
                    </div>
                </div>
            </div>
        </article>
    );
};