import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { theme } from './theme';
import { store } from './store';
import { AppRoutes } from './routes/AppRoutes';
import { authService } from './services';
import { AppWrapper } from './components/AppWrapper';
import { QueryProvider } from './providers/QueryProvider';
import { bundleUtils, performanceUtils, runAccessibilityAudit } from './utils';

function App() {
  // Initialize auth service on app startup
  React.useEffect(() => {
    performanceUtils.mark('app-init-start');
    authService.initialize();
    performanceUtils.mark('app-init-end');
    performanceUtils.measure('app-initialization', 'app-init-start', 'app-init-end');
  }, []);

  // Preload critical routes based on user authentication
  React.useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const state = store.getState();
      if (state.auth.isAuthenticated && state.auth.user?.role) {
        bundleUtils.preloadCriticalRoutes(state.auth.user.role);
      }
    });

    return unsubscribe;
  }, []);

  // Run accessibility audit in development
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      const timer = setTimeout(() => {
        runAccessibilityAudit();
      }, 2000); // Wait for components to render

      return () => clearTimeout(timer);
    }
  }, []);

  return (
    <Provider store={store}>
      <QueryProvider>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <BrowserRouter>
            <AppWrapper>
              <AppRoutes />
            </AppWrapper>
          </BrowserRouter>
        </ThemeProvider>
      </QueryProvider>
    </Provider>
  );
}

export default App;
