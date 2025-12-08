import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { theme } from './theme/theme';
import { store } from './store';
import { AppRoutes } from './routes/AppRoutes';
import { authService } from './services';
import { AppWrapper } from './components/AppWrapper';
import { QueryProvider } from './providers/QueryProvider';

function App() {
  // Initialize auth service on app startup
  React.useEffect(() => {
    try {
      authService.initialize();
    } catch (error) {
      console.error('Auth initialization error:', error);
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
