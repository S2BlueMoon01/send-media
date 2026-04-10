import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { SettingsProvider } from './hooks/useSettings';

// Initialize Eruda for mobile debugging (only in development or when ?debug=true)
if (import.meta.env.DEV || window.location.search.includes('debug=true')) {
  import('eruda').then((eruda) => eruda.default.init());
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </React.StrictMode>,
);
