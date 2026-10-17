import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { initRipple } from './utils/misc';
import './styles/tokens.css';
import './styles/base.css';

initRipple();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      containerStyle={{ top: 86 }}
      toastOptions={{
        duration: 4000,
        className: 'toast',
        style: {
          background: 'var(--surface)',
          color: 'var(--text)',
          border: '1px solid var(--border-strong)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-lg)',
          padding: '12px 16px',
        },
      }}
    />
  </StrictMode>,
);
