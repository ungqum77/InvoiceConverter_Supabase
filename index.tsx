import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// 전역 에러 핸들러: 브라우저가 죽기 전에 에러를 포착하려고 시도합니다.
window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global JS Error:", message, error);
  // 치명적인 루프가 의심될 경우 로컬 스토리지 초기화 제안
  if (message.toString().includes("too many") || message.toString().includes("recursion")) {
     if (confirm("앱에 무한 루프가 감지되었습니다. 데이터를 초기화하고 다시 시작하시겠습니까?")) {
        localStorage.clear();
        window.location.reload();
     }
  }
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
// React.StrictMode를 제거하여 개발 모드에서의 이중 렌더링으로 인한 부작용(루프 등)을 방지합니다.
root.render(<App />);