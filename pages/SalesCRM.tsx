
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchSalesRecords } from '../services/dbService';
import { SalesRecord } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Calendar, DollarSign, TrendingUp, Package, Filter, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export const SalesCRM: React.FC = () => {
    const { user } = useAuth();
    const [records, setRecords] = useState<SalesRecord[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filters
    const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10)); // Default today
    const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
    const [supplierFilter, setSupplierFilter] = useState('');

    useEffect(() => {
        if (user) loadData();
    }, [user, startDate, endDate]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await fetchSalesRecords(startDate, endDate);
            setRecords(data);
        } catch (e) { console.error(e); } finally { setLoading(false); }
    };

    const filteredRecords = records.filter(r => !supplierFilter || r.supplier_name.includes(supplierFilter));

    // Stats Calculation
    const totalSales = filteredRecords.reduce((sum, r) => sum + r.total_sales_amount, 0);
    const totalPurchase = filteredRecords.reduce((sum, r) => sum + r.total_purchase_amount, 0);
    const totalProfit = filteredRecords.reduce((sum, r) => sum + r.net_profit, 0);
    const totalOrders = filteredRecords.reduce((sum, r) => sum + r.quantity, 0);

    const downloadReport = () => {
        const ws = XLSX.utils.json_to_sheet(filteredRecords.map(r => ({
            "날짜": r.order_date,
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

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2"><TrendingUp className="text-primary"/> 매출 CRM 대시보드</h1>
                    <p className="text-sm text-slate-500">일별 매출, 매입 비용, 순수익을 분석합니다.</p>
                </div>
                <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 px-2">
                        <Calendar size={16} className="text-slate-400"/>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="text-xs border-none focus:ring-0 text-slate-600"/>
                        <span className="text-slate-300">~</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="text-xs border-none focus:ring-0 text-slate-600"/>
                    </div>
                    <div className="w-px h-6 bg-slate-100 mx-1"></div>
                    <input 
                        placeholder="발주처 필터" 
                        className="text-xs border-none focus:ring-0 bg-transparent w-32"
                        value={supplierFilter}
                        onChange={e => setSupplierFilter(e.target.value)}
                    />
                    <button onClick={loadData} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200"><Filter size={14}/></button>
                    <button onClick={downloadReport} className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 font-bold flex items-center gap-1 text-xs"><Download size={14}/> 엑셀</button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 mb-1">총 매출액</div>
                    <div className="text-2xl font-black text-blue-600">{totalSales.toLocaleString()} 원</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 mb-1">총 매입액 (지급)</div>
                    <div className="text-2xl font-black text-red-500">{totalPurchase.toLocaleString()} 원</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 mb-1">순수익</div>
                    <div className="text-2xl font-black text-green-600">{totalProfit.toLocaleString()} 원</div>
                </div>
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 mb-1">총 판매수량</div>
                    <div className="text-2xl font-black text-slate-700">{totalOrders.toLocaleString()} 개</div>
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-sm text-slate-700">상세 내역</div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase">
                            <tr>
                                <th className="px-4 py-3">날짜</th>
                                <th className="px-4 py-3">발주처</th>
                                <th className="px-4 py-3">제품명</th>
                                <th className="px-4 py-3 text-right">수량</th>
                                <th className="px-4 py-3 text-right">매출</th>
                                <th className="px-4 py-3 text-right">매입</th>
                                <th className="px-4 py-3 text-right">수익</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRecords.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-slate-400">데이터가 없습니다.</td></tr>
                            ) : (
                                filteredRecords.map(r => (
                                    <tr key={r.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3">{new Date(r.order_date).toLocaleDateString()}</td>
                                        <td className="px-4 py-3">{r.supplier_name}</td>
                                        <td className="px-4 py-3 truncate max-w-[200px]" title={r.product_name}>{r.product_name}</td>
                                        <td className="px-4 py-3 text-right font-mono">{r.quantity}</td>
                                        <td className="px-4 py-3 text-right font-mono text-blue-600">{r.total_sales_amount.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-mono text-red-500">{r.total_purchase_amount.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right font-mono font-bold text-green-600 bg-green-50">{r.net_profit.toLocaleString()}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
