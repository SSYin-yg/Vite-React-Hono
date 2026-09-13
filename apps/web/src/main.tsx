import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
// 旧站样式整套接入：保证营销页/目录/详情视觉与原站一致
// 已从仓库外（D:\B2B\assets）内联进本仓库，否则 CI 构建机拿不到这些文件
import './styles/legacy/common.css';
import './styles/legacy/home.css';
import './styles/legacy/catalog.css';
import './styles/legacy/pages.css';
import './styles/legacy/faq.css';
import './styles/legacy/product.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
