import React, { ErrorInfo, ReactNode } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { ProductManagement } from './pages/ProductManagement';
import { InvoiceConverter } from './pages/InvoiceConverter';
import { Auth } from './pages/Auth';
import { AdminDashboard } from './pages/AdminDashboard';
import { InvoiceMatcher } from './pages/InvoiceMatcher';
import { AuthProvider } from './contexts/AuthContext';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './components/Button';

// --- ErrorBoundary Component ---
interface ErrorBoundaryProps { 
  children?: ReactNode; 
}

interface ErrorBoundaryState { 
  hasError: boolean; 
  error: Error | null; 
}

/**
 * captures errors in the react component tree.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-2xl border border-red-100 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">앱 실행 중 오류가 발생했습니다</h1>
            <p className="text-sm text-slate-500 mb-6 leading-relaxed">
              일시적인 통신 오류이거나 설정 문제입니다.<br/>
              아래 버튼을 눌러 앱을 초기화해 보세요.
            </p>
            <div className="bg-slate-50 p-3 rounded-lg mb-6 text-left overflow-auto max-h-32">
               <p className="text-[10px] font-mono text-red-500">{this.state.error?.stack || this.state.error?.message}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button className="w-full" onClick={() => window.location.href = '/'} icon={<RefreshCw size={16}/>}>
                새로고침 및 홈으로
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => { localStorage.clear(); window.location.reload(); }}>
                데이터 초기화 후 재시작
              </Button>
            </div>
          </div>
        </div>
      );
    }
    
    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <HashRouter>
          <div className="min-h-screen bg-background-light">
            <Navbar />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/products" element={<ProductManagement />} />
              <Route path="/convert" element={<InvoiceConverter />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/match" element={<InvoiceMatcher />} />
            </Routes>
          </div>
        </HashRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
};

export default App;