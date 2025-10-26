// Lazy loading utilities for better performance

import React, { ComponentType, LazyExoticComponent } from 'react';

/**
 * Enhanced lazy loading with retry mechanism
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  componentName: string = 'Component'
): LazyExoticComponent<T> {
  return React.lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem(`retry-lazy-refreshed-${componentName}`) || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem(`retry-lazy-refreshed-${componentName}`, 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        // Assuming that the user is not on the latest version of the application.
        // Let's refresh the page to force the browser to download the latest version.
        window.sessionStorage.setItem(`retry-lazy-refreshed-${componentName}`, 'true');
        return window.location.reload() as never;
      }

      // The page has already been reloaded
      // Assuming that user is already using the latest version of the application.
      // Let's let the application crash and raise the error.
      throw error;
    }
  });
}

/**
 * Preload a lazy component
 */
export function preloadComponent<T extends ComponentType<any>>(
  lazyComponent: LazyExoticComponent<T>
): void {
  // Access the _payload property to trigger the import
  const componentImporter = (lazyComponent as any)._payload;
  if (componentImporter && typeof componentImporter._result === 'undefined') {
    componentImporter._result = componentImporter._init(componentImporter._payload);
  }
}

/**
 * Create a lazy component with preloading capability
 */
export function createLazyComponent<T extends ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>,
  componentName: string = 'Component'
): {
  Component: LazyExoticComponent<T>;
  preload: () => void;
} {
  const Component = lazyWithRetry(componentImport, componentName);
  
  const preload = () => {
    preloadComponent(Component);
  };

  return { Component, preload };
}

/**
 * Intersection Observer based lazy loading for images and components
 */
export class LazyLoadManager {
  private observer: IntersectionObserver;
  private loadedElements = new Set<Element>();

  constructor(options: IntersectionObserverInit = {}) {
    this.observer = new IntersectionObserver(
      this.handleIntersection.bind(this),
      {
        rootMargin: '50px',
        threshold: 0.1,
        ...options,
      }
    );
  }

  private handleIntersection(entries: IntersectionObserverEntry[]) {
    entries.forEach((entry) => {
      if (entry.isIntersecting && !this.loadedElements.has(entry.target)) {
        this.loadElement(entry.target);
        this.loadedElements.add(entry.target);
        this.observer.unobserve(entry.target);
      }
    });
  }

  private loadElement(element: Element) {
    if (element instanceof HTMLImageElement) {
      const dataSrc = element.getAttribute('data-src');
      if (dataSrc) {
        element.src = dataSrc;
        element.removeAttribute('data-src');
      }
    }

    // Trigger custom load event
    const loadEvent = new CustomEvent('lazyload', { detail: { element } });
    element.dispatchEvent(loadEvent);
  }

  observe(element: Element) {
    this.observer.observe(element);
  }

  unobserve(element: Element) {
    this.observer.unobserve(element);
    this.loadedElements.delete(element);
  }

  disconnect() {
    this.observer.disconnect();
    this.loadedElements.clear();
  }
}

// Global lazy load manager instance
export const globalLazyLoadManager = new LazyLoadManager();

/**
 * Hook for lazy loading images
 */
export function useLazyImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = React.useState(placeholder || '');
  const [isLoaded, setIsLoaded] = React.useState(false);
  const imgRef = React.useRef<HTMLImageElement>(null);

  React.useEffect(() => {
    const imgElement = imgRef.current;
    if (!imgElement) return;

    const handleLoad = () => {
      setImageSrc(src);
      setIsLoaded(true);
    };

    imgElement.addEventListener('lazyload', handleLoad);
    imgElement.setAttribute('data-src', src);
    globalLazyLoadManager.observe(imgElement);

    return () => {
      imgElement.removeEventListener('lazyload', handleLoad);
      globalLazyLoadManager.unobserve(imgElement);
    };
  }, [src]);

  return { imgRef, imageSrc, isLoaded };
}

/**
 * Bundle splitting utilities
 */
export const bundleUtils = {
  // Preload critical routes based on user role
  preloadCriticalRoutes: (userRole: string) => {
    switch (userRole) {
      case 'admin':
        // Preload admin dashboard and user management
        import('../pages/admin').then(module => module.AdminDashboard);
        import('../pages/admin').then(module => module.UserManagement);
        break;
      case 'employee':
        // Preload employee dashboard
        import('../pages/employee').then(module => module.EmployeeDashboard);
        break;
      case 'client':
        // Preload client dashboard
        import('../pages/client').then(module => module.ClientDashboard);
        break;
    }
  },

  // Preload components on hover (for navigation items)
  preloadOnHover: (componentImport: () => Promise<any>) => {
    let preloaded = false;
    return () => {
      if (!preloaded) {
        preloaded = true;
        componentImport().catch(() => {
          preloaded = false; // Reset on error
        });
      }
    };
  },

  // Preload components on idle
  preloadOnIdle: (componentImport: () => Promise<any>) => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => {
        componentImport();
      });
    } else {
      // Fallback for browsers without requestIdleCallback
      setTimeout(() => {
        componentImport();
      }, 1000);
    }
  },
};