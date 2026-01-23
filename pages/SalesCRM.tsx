
import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchSalesRecords, deleteSalesRecords } from '../services/dbService';
import { SalesRecord } from '../types';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Calendar, TrendingUp, Filter, Download, PieChart, BarChart2, RefreshCw, Trash2, Calculator, CheckSquare, Square } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '../components/Button';

export const SalesCRM: React.FC = () => {
    const { user } = useAuth();
    const [records, setRecords] = useState<SalesRecord[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10)); // Default today
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
    const [supplierFilter, setSupplierFilter] = useState('');
    const [productFilter, setProductFilter] = useState('');
    const [chartMode, setChartMode] = useState<'date' | 'supplier'>('date');
    
    // Selection for deletion
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (user) loadData();
    }, [user, startDate, endDate]);

    const loadData = async () => {
        setLoading(true);
        setSelectedIds(new Set()); // Clear selection on reload
        try {
            const data = await fetchSalesRecords(startDate, endDate);
            setRecords(data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const setPeriod = (type: 'today' | 'yesterday' | 'week' | 'month' | 'all') => {
        const today = new Date();
        const start = new Date();
        let endStr = today.toISOString().slice(0, 10);
        
        if (type === 'today') {
            // start is already today
        } else if (type === 'yesterday') {
            start.setDate(today.getDate() - 1);
            const y = new Date(today); y.setDate(today.getDate() - 1);
            endStr = y.toISOString().slice(0, 10);
        } else if (type === 'week') {
            start.setDate(today.getDate() - 7);
        } else if (type === 'month') {
            start.setMonth(today.getMonth() - 1);
        } else if (type === 'all') {
            start.setFullYear(2020);
        }
        setStartDate(start.toISOString().slice(0, 10));
        setEndDate(endStr);
    };

    const filteredRecords = records.filter(r => {
        const matchesSupplier = !supplierFilter || r.supplier_name.includes(supplierFilter);
        const matchesProduct = !productFilter || r.product_name.toLowerCase().includes(productFilter.toLowerCase());
        return matchesSupplier && matchesProduct;
    });

    // Stats Calculation
    const totalSales = filteredRecords.reduce((sum, r) => sum + r.total_sales_amount, 0);
    const totalPurchase = filteredRecords.reduce((sum, r) => sum + r.total_purchase_amount, 0);
    const totalProfit = filteredRecords.reduce((sum, r) => sum + r.net_profit, 0);
    const totalOrders = filteredRecords.reduce((sum, r) => sum + r.quantity, 0);
    const roi = totalPurchase > 0 ? (totalProfit / totalSales) * 100 : 0;

    // Chart Data Generation
    const chartData = useMemo(() => {
        const grouped: Record<string, { name: string, sales: number, profit: number }> = {};
        
        filteredRecords.forEach(r => {
            let key = '';
            if (chartMode === 'date') key = new Date(r.order_date).toLocaleDateString();
            else key = r.supplier_name;

            if (!grouped[key]) grouped[key] = { name: key, sales: 0, profit: 0 };
            grouped[key].sales += r.total_sales_amount;
            grouped[key].profit += r.net_profit;
        });

        return Object.values(grouped).sort((a, b) => chartMode === 'date' ? new Date(a.name).getTime() - new Date(b.name).getTime() : b.sales - a.sales);
    }, [filteredRecords, chartMode]);

    const downloadReport = () => {
        const ws = XLSX.utils.json_to_sheet(filteredRecords.map(r => ({
            "날짜": new Date(r.order_date).toLocaleDateString(),
            "발주처": r.supplier_name,
            "제품명": r.product_name,
            "SKU": r.product_sku,
            "수량": r.quantity,
            "매출액": r.total_sales_amount,
            "매입액": r.total_purchase_amount,
            "배송비": r.total_shipping_cost,
            "수수료": r.total_market_fee,
            "순수익": r.net_profit
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Sales_Report");
        XLSX.writeFile(wb, `매출리포트_${startDate}_${endDate}.xlsx`);
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filteredRecords.length && filteredRecords.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredRecords.map(r => r.id)));
        }
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        if (!confirm(`${selectedIds.size}건의 기록을 삭제하시겠습니까?`)) return;
        
        try {
            await deleteSalesRecords(Array.from(selectedIds));
            alert("삭제되었습니다.");
            loadData();
        } catch (e: any) {
            alert("삭제 실패: " + e.message);
        }
    };

    const handleDeleteAllFiltered = async () => {
        if (filteredRecords.length === 0) return;
        if (!confirm(`현재 필터링된 ${filteredRecords.length}건의 모든 기록을 삭제하시겠습니까? (복구 불가)`)) return;
        
        try {
            const allIds = filteredRecords.map(r => r.id);
            await deleteSalesRecords(allIds);
            alert("삭제되었습니다.");
            loadData();
        } catch (e: any) {
            alert("삭제 실패: " + e.message);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><TrendingUp className="text-primary"/> 매출 CRM 대시보드</h1>
                    <p className="text-sm text-slate-500 mt-1">일별 매출, 매입 비용, 순수익을 분석합니다.</p>
                </div>
                <div className="flex flex-col items-end gap-2 w-full md:w-auto">
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button onClick={() => setPeriod('today')} className="px-3 py-1 text-xs font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded transition-all">오늘</button>
                        <button onClick={() => setPeriod('week')} className="px-3 py-1 text-xs font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded transition-all">이번주</button>
                        <button onClick={() => setPeriod('month')} className="px-3 py-1 text-xs font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded transition-all">이번달</button>
                        <button onClick={() => setPeriod('all')} className="px-3 py-1 text-xs font-bold text-slate-600 hover:bg-white hover:shadow-sm rounded transition-all">전체</button>
                    </div>
                    <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm w-full md:w-auto justify-end">
                        <div className="flex items-center gap-2 px-2">
                            <Calendar size={16} className="text-slate-400"/>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs border-none focus:ring-0 text-slate-600 font-medium"/>
                            <span className="text-slate-300">~</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs border-none focus:ring-0 text-slate-600 font-medium"/>
                        </div>
                        <div className="w-px h-6 bg-slate-100 mx-1"></div>
                        <input 
                            placeholder="발주처 검색" 
                            className="text-xs border-none focus:ring-0 bg-transparent w-20 md:w-24"
                            value={supplierFilter}
                            onChange={e => setSupplierFilter(e.target.value)}
                        />
                        <div className="w-px h-6 bg-slate-100 mx-1"></div>
                        <input 
                            placeholder="제품명 검색" 
                            className="text-xs border-none focus:ring-0 bg-transparent w-24 md:w-32"
                            value={productFilter}
                            onChange={e => setProductFilter(e.target.value)}
                        />
                        <button onClick={loadData} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 text-slate-600"><RefreshCw size={14}/></button>
                        <button onClick={downloadReport} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 font-bold flex items-center gap-1 text-xs"><Download size={14}/> 엑셀</button>
                    </div>
                </div>
            </div>
            
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-blue-300 transition-colors">
                    <div className="text-xs font-bold text-slate-400 mb-1">총 매출액</div>
                    <div className="text-2xl font-black text-blue-600 tracking-tight">{totalSales.toLocaleString()} <span className="text-sm font-medium text-slate-400">원</span></div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-red-300 transition-colors">
                    <div className="text-xs font-bold text-slate-400 mb-1">총 매입액 (지급)</div>
                    <div className="text-2xl font-black text-red-500 tracking-tight">{totalPurchase.toLocaleString()} <span className="text-sm font-medium text-slate-400">원</span></div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-green-300 transition-colors">
                    <div className="text-xs font-bold text-slate-400 mb-1">순수익</div>
                    <div className="text-2xl font-black text-green-600 tracking-tight">{totalProfit.toLocaleString()} <span className="text-sm font-medium text-slate-400">원</span></div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-purple-300 transition-colors">
                    <div className="text-xs font-bold text-slate-400 mb-1">수익률 (ROI)</div>
                    <div className="text-2xl font-black text-purple-600 tracking-tight flex items-center gap-1">
                        {roi.toFixed(1)}% 
                        <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">마진</span>
                    </div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover:border-slate-300 transition-colors">
                    <div className="text-xs font-bold text-slate-400 mb-1">총 판매수량</div>
                    <div className="text-2xl font-black text-slate-700 tracking-tight">{totalOrders.toLocaleString()} <span className="text-sm font-medium text-slate-400">개</span></div>
                </div>
            </div>

            {/* Detailed Table (Moved Above Chart) */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mb-6">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                    <span className="font-bold text-sm text-slate-700">상세 거래 내역 (총 {filteredRecords.length}건)</span>
                    <div className="flex gap-2">
                        {selectedIds.size > 0 && (
                            <Button size="sm" variant="outline" className="text-xs h-8 border-red-200 text-red-600 hover:bg-red-50" onClick={handleDeleteSelected}>
                                <Trash2 size={12} className="mr-1"/> 선택 삭제 ({selectedIds.size})
                            </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-xs h-8 text-slate-400 hover:text-red-500" onClick={handleDeleteAllFiltered}>
                            전체 삭제
                        </Button>
                    </div>
                </div>
                <div className="overflow-x-auto max-h-[500px]">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 w-10">
                                    <button onClick={toggleSelectAll} className="flex items-center justify-center text-slate-400 hover:text-primary">
                                        {selectedIds.size > 0 && selectedIds.size === filteredRecords.length ? <CheckSquare size={16}/> : <Square size={16}/>}
                                    </button>
                                </th>
                                <th className="px-4 py-3 whitespace-nowrap bg-slate-50">날짜</th>
                                <th className="px-4 py-3 whitespace-nowrap bg-slate-50">발주처</th>
                                <th className="px-4 py-3 bg-slate-50">제품명 (옵션포함)</th>
                                <th className="px-4 py-3 text-right bg-slate-50">수량</th>
                                <th className="px-4 py-3 text-right bg-slate-50">매출</th>
                                <th className="px-4 py-3 text-right bg-slate-50">매입</th>
                                <th className="px-4 py-3 text-right bg-slate-50">수익률</th>
                                <th className="px-4 py-3 text-right bg-slate-50 text-green-600">수익</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRecords.length === 0 ? (
                                <tr><td colSpan={9} className="p-12 text-center text-slate-400">해당 기간의 데이터가 없습니다.</td></tr>
                            ) : (
                                filteredRecords.map(r => {
                                    const itemRoi = r.total_sales_amount > 0 ? (r.net_profit / r.total_sales_amount) * 100 : 0;
                                    return (
                                        <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${selectedIds.has(r.id) ? 'bg-blue-50/50' : ''}`}>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => toggleSelection(r.id)} className={`flex items-center justify-center ${selectedIds.has(r.id) ? 'text-primary' : 'text-slate-300'}`}>
                                                    {selectedIds.has(r.id) ? <CheckSquare size={16}/> : <Square size={16}/>}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(r.order_date).toLocaleDateString()}</td>
                                            <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{r.supplier_name}</td>
                                            <td className="px-4 py-3 max-w-[300px]" title={r.product_name}>
                                                <div className="line-clamp-1">{r.product_name}</div>
                                                <div className="text-[10px] text-slate-400 font-mono hidden sm:block">{r.product_sku}</div>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono font-bold">{r.quantity}</td>
                                            <td className="px-4 py-3 text-right font-mono text-blue-600">{r.total_sales_amount.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-mono text-red-500">{r.total_purchase_amount.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-400">{itemRoi.toFixed(0)}%</td>
                                            <td className="px-4 py-3 text-right font-mono font-bold text-green-600 bg-green-50/30">{r.net_profit.toLocaleString()}</td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                        {/* Summary Footer */}
                        {filteredRecords.length > 0 && (
                            <tfoot className="sticky bottom-0 z-10 bg-slate-100 font-black text-slate-800 border-t-2 border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                                <tr>
                                    <td colSpan={4} className="px-4 py-3 text-center">합 계</td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-900">{totalOrders.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right font-mono text-blue-700">{totalSales.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right font-mono text-red-600">{totalPurchase.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-500">{roi.toFixed(1)}%</td>
                                    <td className="px-4 py-3 text-right font-mono text-green-700 bg-green-100">{totalProfit.toLocaleString()}</td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>

            {/* Chart Section */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 animate-fade-in">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        {chartMode === 'date' ? <TrendingUp size={18} className="text-indigo-500"/> : <BarChart2 size={18} className="text-indigo-500"/>}
                        매출 및 수익 추이
                    </h3>
                    <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-bold">
                        <button onClick={() => setChartMode('date')} className={`px-3 py-1.5 rounded-md transition-all ${chartMode === 'date' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>일별 추이</button>
                        <button onClick={() => setChartMode('supplier')} className={`px-3 py-1.5 rounded-md transition-all ${chartMode === 'supplier' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>발주처별</button>
                    </div>
                </div>
                <div className="h-[300px] w-full">
                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                <XAxis dataKey="name" tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} dy={10} />
                                <YAxis tick={{fontSize: 11, fill: '#64748b'}} axisLine={false} tickLine={false} tickFormatter={(value) => `${(value/10000).toFixed(0)}만`} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                    formatter={(value: number) => value.toLocaleString() + '원'}
                                />
                                <Legend wrapperStyle={{fontSize: '12px', paddingTop: '20px'}}/>
                                <Area type="monotone" dataKey="sales" name="매출액" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" />
                                <Area type="monotone" dataKey="profit" name="순수익" stroke="#22c55e" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400 text-sm">데이터가 없습니다.</div>
                    )}
                </div>
            </div>
        </div>
    );
};
