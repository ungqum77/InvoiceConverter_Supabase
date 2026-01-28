
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchUserGuides } from '../services/dbService';
import { UserGuide } from '../types';
import { HelpCircle, ChevronRight, Loader2, Book } from 'lucide-react';

export const UserGuideList: React.FC = () => {
    const [guides, setGuides] = useState<UserGuide[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchUserGuides();
                setGuides(data);
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
                <span className="inline-block px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold mb-4">User Guide</span>
                <h1 className="text-4xl font-black text-slate-900 mb-4 tracking-tight">사용설명서</h1>
                <p className="text-slate-500 max-w-2xl mx-auto">송장.com의 기능을 100% 활용하는 방법을 안내해 드립니다.</p>
            </div>

            {guides.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <HelpCircle className="mx-auto text-slate-300 mb-4" size={48}/>
                    <p className="text-slate-500 font-bold">아직 등록된 가이드가 없습니다.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {guides.map(guide => (
                        <Link to={`/guides/${guide.slug}`} key={guide.id} className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                            {guide.thumbnail_url && (
                                <div className="h-40 overflow-hidden bg-slate-100">
                                    <img src={guide.thumbnail_url} alt={guide.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                                </div>
                            )}
                            <div className="p-5 flex flex-col flex-1">
                                <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                                    <Book size={12}/>
                                    <span>가이드</span>
                                </div>
                                <h2 className="text-lg font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-primary transition-colors">{guide.title}</h2>
                                <p className="text-slate-500 text-sm line-clamp-2 mb-4 flex-1">{guide.excerpt || guide.content.replace(/<[^>]*>?/gm, '').slice(0, 80)}...</p>
                                <div className="flex items-center text-primary font-bold text-xs mt-auto">
                                    자세히 보기 <ChevronRight size={14} className="ml-1 group-hover:translate-x-1 transition-transform"/>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
};
