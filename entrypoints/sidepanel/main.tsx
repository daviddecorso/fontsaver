import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/src/ui/index.css';
import App from '../library/App';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App isSidePanel />
    </React.StrictMode>,
  );
}
