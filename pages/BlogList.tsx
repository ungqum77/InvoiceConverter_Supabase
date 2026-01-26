import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchBlogPosts } from '../services/dbService';
import { BlogPost } from '../types';
import { BookOpen, Calendar, ChevronRight, Loader2 } from 'lucide-react';

export const BlogList: React.FC = () => {
    const [posts, setPosts] = useState<BlogPost[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchBlogPosts();
                setPosts(data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    if (loading) return <div className="flex justify-center items-center min-h-[50vh]"><Loader2 className="animate-spin text-primary" size={32}/></div>;

    return (
        <div className="max-w-5xl mx-auto px-4 py-12">
            <div className="text-center mb-16">
                <span className="inline-block px-3 py-1 bg-blue-50 text-primary rounded-full text-xs font-bold mb-4">Blog & Resources</span>
                <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">송장.com 인사이트</h1>
                <p className="text-slate-500 max-w-2xl mx-auto">쇼핑몰 운영, 엑셀 업무 자동화, 물류 관리 팁을 공유합니다.</p>
            </div>

            {posts.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <BookOpen className="mx-auto text-slate-300 mb-4" size={48}/>
                    <p className="text-slate-500 font-bold">아직 등록된 게시글이 없습니다.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {posts.map(post => (
                        <Link to={`/blog/${post.slug}`} key={post.id} className="group flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                            {post.thumbnail_url && (
                                <div className="h-48 overflow-hidden bg-slate-100">
                                    <img src={post.thumbnail_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                </div>
                            )}
                            <div className="p-6 flex flex-col flex-1">
                                <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                                    <Calendar size={14}/>
                                    <span>{new Date(post.created_at).toLocaleDateString()}</span>
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 mb-3 line-clamp-2 group-hover:text-primary transition-colors">{post.title}</h2>
                                <p className="text-slate-500 text-sm line-clamp-3 mb-6 flex-1">{post.excerpt || post.content.replace(/<[^>]*>?/gm, '').slice(0, 100)}...</p>
                                <div className="flex items-center text-primary font-bold text-sm mt-auto">
                                    Read Article <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform"/>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};