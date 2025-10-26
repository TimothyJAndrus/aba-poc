// Performance monitoring and optimization utilities

/**
 * Web Vitals monitoring
 */
export interface WebVitalsMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  delta: number;
  id: string;
}

export class PerformanceMonitor {
  private metrics: Map<string, WebVitalsMetric> = new Map();
  private observers: PerformanceObserver[] = [];

  constructor() {
    this.initializeObservers();
  }

  private initializeObservers() {
    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as PerformanceEntry & {
            renderTime?: number;
            loadTime?: number;
          };
          
          if (lastEntry) {
            const value = lastEntry.renderTime || lastEntry.loadTime || 0;
            this.recordMetric('LCP', value);
          }
        });
        
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (e) {
        console.warn('LCP observer not supported');
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: PerformanceEntry & { processingStart?: number }) => {
            const value = entry.processingStart ? entry.processingStart - entry.startTime : 0;
            this.recordMetric('FID', value);
          });
        });
        
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (e) {
        console.warn('FID observer not supported');
      }

      // Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: PerformanceEntry & { value?: number; hadRecentInput?: boolean }) => {
            if (!entry.hadRecentInput && entry.value) {
              clsValue += entry.value;
            }
          });
          this.recordMetric('CLS', clsValue);
        });
        
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (e) {
        console.warn('CLS observer not supported');
      }
    }
  }

  private recordMetric(name: string, value: number) {
    const rating = this.getRating(name, value);
    const metric: WebVitalsMetric = {
      name,
      value,
      rating,
      delta: value - (this.metrics.get(name)?.value || 0),
      id: `${name}-${Date.now()}`,
    };
    
    this.metrics.set(name, metric);
    this.reportMetric(metric);
  }

  private getRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = {
      LCP: { good: 2500, poor: 4000 },
      FID: { good: 100, poor: 300 },
      CLS: { good: 0.1, poor: 0.25 },
    };

    const threshold = thresholds[name as keyof typeof thresholds];
    if (!threshold) return 'good';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  private reportMetric(metric: WebVitalsMetric) {
    // Log to console in development
    if (import.meta.env.DEV) {
      console.log(`Performance Metric - ${metric.name}:`, {
        value: metric.value,
        rating: metric.rating,
        delta: metric.delta,
      });
    }

    // In production, you could send to analytics service
    // Example: analytics.track('web-vital', metric);
  }

  getMetrics(): WebVitalsMetric[] {
    return Array.from(this.metrics.values());
  }

  disconnect() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
    this.metrics.clear();
  }
}

/**
 * Bundle size analyzer
 */
export class BundleAnalyzer {
  static async analyzeBundleSize(): Promise<{
    totalSize: number;
    chunks: Array<{ name: string; size: number }>;
  }> {
    if (!('performance' in window) || !performance.getEntriesByType) {
      return { totalSize: 0, chunks: [] };
    }

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const jsResources = resources.filter(resource => 
      resource.name.includes('.js') && 
      !resource.name.includes('node_modules')
    );

    const chunks = jsResources.map(resource => ({
      name: resource.name.split('/').pop() || 'unknown',
      size: resource.transferSize || 0,
    }));

    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);

    return { totalSize, chunks };
  }

  static logBundleInfo() {
    this.analyzeBundleSize().then(({ totalSize, chunks }) => {
      console.group('Bundle Analysis');
      console.log(`Total JS Size: ${(totalSize / 1024).toFixed(2)} KB`);
      console.table(chunks.map(chunk => ({
        ...chunk,
        sizeKB: (chunk.size / 1024).toFixed(2),
      })));
      console.groupEnd();
    });
  }
}

/**
 * Memory usage monitor
 */
export class MemoryMonitor {
  private intervalId?: number;

  startMonitoring(intervalMs: number = 30000) {
    if (!('memory' in performance)) {
      console.warn('Memory monitoring not supported in this browser');
      return;
    }

    this.intervalId = window.setInterval(() => {
      const memory = (performance as any).memory;
      const memoryInfo = {
        used: Math.round(memory.usedJSHeapSize / 1048576), // MB
        total: Math.round(memory.totalJSHeapSize / 1048576), // MB
        limit: Math.round(memory.jsHeapSizeLimit / 1048576), // MB
      };

      if (import.meta.env.DEV) {
        console.log('Memory Usage:', memoryInfo);
      }

      // Warn if memory usage is high
      if (memoryInfo.used / memoryInfo.limit > 0.8) {
        console.warn('High memory usage detected:', memoryInfo);
      }
    }, intervalMs);
  }

  stopMonitoring() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  getCurrentMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: Math.round(memory.usedJSHeapSize / 1048576),
        total: Math.round(memory.totalJSHeapSize / 1048576),
        limit: Math.round(memory.jsHeapSizeLimit / 1048576),
      };
    }
    return null;
  }
}

/**
 * Performance timing utilities
 */
export const performanceUtils = {
  // Measure function execution time
  measureFunction: <T extends (...args: any[]) => any>(
    fn: T,
    name?: string
  ): T => {
    return ((...args: Parameters<T>) => {
      const start = performance.now();
      const result = fn(...args);
      const end = performance.now();
      
      if (import.meta.env.DEV) {
        console.log(`${name || fn.name || 'Function'} took ${(end - start).toFixed(2)}ms`);
      }
      
      return result;
    }) as T;
  },

  // Measure async function execution time
  measureAsyncFunction: <T extends (...args: any[]) => Promise<any>>(
    fn: T,
    name?: string
  ): T => {
    return (async (...args: Parameters<T>) => {
      const start = performance.now();
      const result = await fn(...args);
      const end = performance.now();
      
      if (import.meta.env.DEV) {
        console.log(`${name || fn.name || 'Async Function'} took ${(end - start).toFixed(2)}ms`);
      }
      
      return result;
    }) as T;
  },

  // Create a performance mark
  mark: (name: string) => {
    if ('performance' in window && performance.mark) {
      performance.mark(name);
    }
  },

  // Measure between two marks
  measure: (name: string, startMark: string, endMark?: string) => {
    if ('performance' in window && performance.measure) {
      try {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name, 'measure')[0];
        if (import.meta.env.DEV && measure) {
          console.log(`${name}: ${measure.duration.toFixed(2)}ms`);
        }
        return measure?.duration || 0;
      } catch (e) {
        console.warn('Performance measurement failed:', e);
        return 0;
      }
    }
    return 0;
  },

  // Debounce function for performance
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    immediate?: boolean
  ): T => {
    let timeout: number | undefined;
    
    return ((...args: Parameters<T>) => {
      const later = () => {
        timeout = undefined;
        if (!immediate) func(...args);
      };
      
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = window.setTimeout(later, wait);
      
      if (callNow) func(...args);
    }) as T;
  },

  // Throttle function for performance
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): T => {
    let inThrottle: boolean;
    
    return ((...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    }) as T;
  },
};

// Global performance monitor instance
export const globalPerformanceMonitor = new PerformanceMonitor();
export const globalMemoryMonitor = new MemoryMonitor();

// Initialize performance monitoring in production
if (import.meta.env.PROD) {
  globalMemoryMonitor.startMonitoring();
  BundleAnalyzer.logBundleInfo();
}