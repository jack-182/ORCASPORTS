import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener(
    'error',
    (event) => {
      const src = event.filename || '';
      if (
        src.startsWith('chrome-extension://') ||
        src.startsWith('moz-extension://') ||
        src.startsWith('safari-extension://')
      ) {
        event.preventDefault();
      }
    },
    true
  );
}

createRoot(document.getElementById('root')!).render(<App />);
