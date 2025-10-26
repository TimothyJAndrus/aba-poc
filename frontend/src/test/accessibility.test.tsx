import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { Button } from '../components/common/Button';
import { MetricCard } from '../components/common/MetricCard';
import { FormBuilder } from '../components/common/FormBuilder';
import { LoginForm } from '../components/auth/LoginForm';
import { mockUsers, createTestStore } from './utils';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { theme } from '../theme/theme';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

const renderWithProviders = (component: React.ReactElement) => {
  const store = createTestStore({
    auth: {
      user: mockUsers.admin,
      isAuthenticated: true,
      token: 'mock-token',
    },
  });

  return render(
    <Provider store={store}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          {component}
        </ThemeProvider>
      </BrowserRouter>
    </Provider>
  );
};

describe('Accessibility Tests', () => {
  it('Button component should not have accessibility violations', async () => {
    const { container } = renderWithProviders(
      <Button>Accessible Button</Button>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('MetricCard component should not have accessibility violations', async () => {
    const mockMetric = {
      title: 'Total Sessions',
      value: 150,
      trend: {
        direction: 'up' as const,
        percentage: 12,
      },
      color: 'primary' as const,
    };

    const { container } = renderWithProviders(
      <MetricCard {...mockMetric} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('FormBuilder component should not have accessibility violations', async () => {
    const mockFields = [
      {
        name: 'email',
        label: 'Email Address',
        type: 'email' as const,
        required: true,
      },
      {
        name: 'name',
        label: 'Full Name',
        type: 'text' as const,
        required: true,
      },
    ];

    const { container } = renderWithProviders(
      <FormBuilder fields={mockFields} onSubmit={() => {}} />
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('LoginForm component should not have accessibility violations', async () => {
    const { container } = renderWithProviders(<LoginForm />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Components should have proper ARIA labels and roles', async () => {
    const { container } = renderWithProviders(
      <div>
        <Button aria-label="Submit form">Submit</Button>
        <div role="alert" aria-live="polite">
          Success message
        </div>
        <nav aria-label="Main navigation">
          <ul>
            <li><a href="/dashboard">Dashboard</a></li>
            <li><a href="/users">Users</a></li>
          </ul>
        </nav>
      </div>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('Form elements should have proper labels and descriptions', async () => {
    const { container } = renderWithProviders(
      <form>
        <label htmlFor="username">Username</label>
        <input 
          id="username" 
          type="text" 
          aria-describedby="username-help"
          required 
        />
        <div id="username-help">Enter your username</div>
        
        <fieldset>
          <legend>Notification Preferences</legend>
          <label>
            <input type="checkbox" />
            Email notifications
          </label>
          <label>
            <input type="checkbox" />
            SMS notifications
          </label>
        </fieldset>
      </form>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});