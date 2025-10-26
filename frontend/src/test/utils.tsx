import React from 'react';
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { configureStore } from '@reduxjs/toolkit';
import { theme } from '../theme/theme';
import authSlice from '../store/authSlice';
import notificationSlice from '../store/notificationSlice';

// Create a test store
const createTestStore = (preloadedState?: any) => {
  return configureStore({
    reducer: {
      auth: authSlice,
      notifications: notificationSlice,
    },
    preloadedState,
  });
};

// Create a test query client
const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

interface AllTheProvidersProps {
  children: React.ReactNode;
  store?: ReturnType<typeof createTestStore>;
  queryClient?: QueryClient;
}

const AllTheProviders = ({ 
  children, 
  store = createTestStore(),
  queryClient = createTestQueryClient()
}: AllTheProvidersProps) => {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  );
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: any;
  store?: ReturnType<typeof createTestStore>;
  queryClient?: QueryClient;
}

const customRender = (
  ui: ReactElement,
  {
    preloadedState,
    store = createTestStore(preloadedState),
    queryClient = createTestQueryClient(),
    ...renderOptions
  }: CustomRenderOptions = {}
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllTheProviders store={store} queryClient={queryClient}>
      {children}
    </AllTheProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Mock user data for testing
export const mockUsers = {
  admin: {
    id: '1',
    name: 'Admin User',
    email: 'admin@example.com',
    role: 'admin' as const,
  },
  employee: {
    id: '2',
    name: 'Employee User',
    email: 'employee@example.com',
    role: 'employee' as const,
  },
  client: {
    id: '3',
    name: 'Client User',
    email: 'client@example.com',
    role: 'client' as const,
  },
};

// Mock session data
export const mockSession = {
  id: '1',
  clientName: 'John Doe',
  rbtName: 'Jane Smith',
  startTime: '2024-01-15T10:00:00Z',
  endTime: '2024-01-15T11:00:00Z',
  status: 'scheduled' as const,
  type: 'therapy' as const,
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render, createTestStore, createTestQueryClient };