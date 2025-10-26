import * as Sentry from '@sentry/react';

export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  const environment = import.meta.env.VITE_ENVIRONMENT || 'development';
  const release = import.meta.env.VITE_SENTRY_RELEASE || `aba-scheduling-ui@${import.meta.env.VITE_APP_VERSION}`;

  if (!dsn) {
    console.warn('Sentry DSN not configured. Error monitoring disabled.');
    return;
  }

  Sentry.init({
    dsn,
    environment,
    release,

    // Performance monitoring
    integrations: [
      Sentry.browserTracingIntegration(),
    ],

    // Set sampling rate for performance monitoring
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/api\.aba-scheduling\.com/,
      /^https:\/\/.*\.aba-scheduling\.com/,
    ],

    // Capture 100% of the transactions for performance monitoring in development
    // Reduce this in production
    tracesSampleRate: environment === 'development' ? 1.0 : 0.1,

    // Capture 100% of the sessions for release health
    replaysSessionSampleRate: environment === 'development' ? 1.0 : 0.1,

    // Capture 100% of the sessions on error
    replaysOnErrorSampleRate: 1.0,

    // Configure error filtering
    beforeSend(event, hint) {
      // Filter out development errors
      if (environment === 'development') {
        console.error('Sentry captured error:', event, hint);
      }

      // Filter out specific errors
      if (event.exception) {
        const error = hint.originalException;

        // Filter out network errors that are not actionable
        if (error instanceof Error) {
          if (error.message.includes('Network Error') ||
            error.message.includes('Failed to fetch')) {
            return null;
          }

          // Filter out WebSocket connection errors in development
          if (environment === 'development' &&
            error.message.includes('WebSocket')) {
            return null;
          }
        }
      }

      return event;
    },

    // Set user context
    initialScope: {
      tags: {
        component: 'frontend',
        version: import.meta.env.VITE_APP_VERSION,
      },
    },

    // Configure allowed URLs
    allowUrls: [
      /https:\/\/.*\.aba-scheduling\.com/,
      /http:\/\/localhost/,
    ],

    // Configure denied URLs
    denyUrls: [
      // Chrome extensions
      /extensions\//i,
      /^chrome:\/\//i,
      /^moz-extension:\/\//i,
    ],

    // Configure maximum breadcrumbs
    maxBreadcrumbs: 50,

    // Configure debug mode
    debug: environment === 'development',



    // Configure send default PII
    sendDefaultPii: false,


  });
};

// Helper function to set user context
export const setSentryUser = (user: {
  id: string;
  email?: string;
  role?: string;
  name?: string;
}) => {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name,
    role: user.role,
  });
};

// Helper function to clear user context
export const clearSentryUser = () => {
  Sentry.setUser(null);
};

// Helper function to add breadcrumb
export const addSentryBreadcrumb = (message: string, category: string, level: Sentry.SeverityLevel = 'info', data?: any) => {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
};

// Helper function to capture exception
export const captureSentryException = (error: Error, context?: Record<string, any>) => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.keys(context).forEach(key => {
        scope.setContext(key, context[key]);
      });
    }
    Sentry.captureException(error);
  });
};

// Helper function to capture message
export const captureSentryMessage = (message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) => {
  Sentry.withScope((scope) => {
    if (context) {
      Object.keys(context).forEach(key => {
        scope.setContext(key, context[key]);
      });
    }
    Sentry.captureMessage(message, level);
  });
};

// Performance monitoring helpers
export const startSentrySpan = (name: string, op: string) => {
  return Sentry.startSpan({ name, op }, (span) => {
    return span;
  });
};

export const startSentryInactiveSpan = (name: string, op: string) => {
  return Sentry.startInactiveSpan({ name, op });
};

// React Error Boundary
export const SentryErrorBoundary = Sentry.ErrorBoundary;

// React Profiler
export const SentryProfiler = Sentry.Profiler;

export default Sentry;