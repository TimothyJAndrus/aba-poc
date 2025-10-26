import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { registerSW, showUpdateAvailableNotification } from './utils/serviceWorker';
import { initSentry } from './utils/sentry';

// Initialize Sentry error monitoring
initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Register service worker for offline functionality and caching
if (import.meta.env.PROD) {
  registerSW({
    onSuccess: () => {
      console.log('App is ready for offline use');
    },
    onUpdate: (registration) => {
      console.log('New app version available');
      showUpdateAvailableNotification(registration);
    },
    onOfflineReady: () => {
      console.log('App is ready to work offline');
    },
  });
}
