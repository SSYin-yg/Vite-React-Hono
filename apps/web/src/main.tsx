import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';
// 旧站样式整套接入：保证营销页/目录/详情视觉与原站一致
import '../../../../assets/common.css';
import '../../../../assets/home.css';
import '../../../../assets/catalog.css';
import '../../../../assets/pages.css';
import '../../../../assets/faq.css';
import '../../../../assets/product.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);
