import {StrictMode, useLayoutEffect} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

function PublicApplication() {
  useLayoutEffect(() => {
    // The CSS dependency is loaded and React has committed the styled shell.
    document.dispatchEvent(new Event('clementino:app-ready'));
  }, []);
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PublicApplication />
  </StrictMode>,
);
