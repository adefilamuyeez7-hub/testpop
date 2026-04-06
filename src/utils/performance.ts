/**
 * Core Web Vitals & Performance Monitoring
 * Location: src/utils/performance.ts
 * Purpose: Track and optimize page performance metrics
 */

/**
 * Core Web Vitals metrics interface
 */
export interface WebVitals {
  lcp?: number; // Largest Contentful Paint (ms)
  fid?: number; // First Input Delay (ms)
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte (ms)
  fcp?: number; // First Contentful Paint (ms)
}

/**
 * Initialize Core Web Vitals tracking
 * Reports metrics to analytics
 */
export async function initializeCoreWebVitals() {
  try {
    const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals');

    // Largest Contentful Paint
    getLCP((metric) => {
      console.log('📊 LCP:', metric.value.toFixed(0), 'ms');
      reportToAnalytics({
        name: 'LCP',
        value: metric.value,
        rating: metric.rating
      });
    });

    // First Input Delay
    getFID((metric) => {
      console.log('📊 FID:', metric.value.toFixed(0), 'ms');
      reportToAnalytics({
        name: 'FID',
        value: metric.value,
        rating: metric.rating
      });
    });

    // Cumulative Layout Shift
    getCLS((metric) => {
      console.log('📊 CLS:', metric.value.toFixed(3));
      reportToAnalytics({
        name: 'CLS',
        value: metric.value,
        rating: metric.rating
      });
    });

    // First Contentful Paint
    getFCP((metric) => {
      console.log('📊 FCP:', metric.value.toFixed(0), 'ms');
      reportToAnalytics({
        name: 'FCP',
        value: metric.value,
        rating: metric.rating
      });
    });

    // Time to First Byte
    getTTFB((metric) => {
      console.log('📊 TTFB:', metric.value.toFixed(0), 'ms');
      reportToAnalytics({
        name: 'TTFB',
        value: metric.value,
        rating: metric.rating
      });
    });
  } catch (error) {
    console.warn('Could not initialize Core Web Vitals:', error);
  }
}

/**
 * Report metrics to Google Analytics
 */
function reportToAnalytics(metric: any) {
  // Send to Google Analytics 4
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', `web_vitals_${metric.name}`, {
      value: Math.round(metric.value),
      event_category: 'web_vitals',
      event_label: metric.name,
      non_interaction: true,
      metric_rating: metric.rating
    });
  }
}

/**
 * Monitor image loading performance
 */
export function optimizeImages() {
  // Use Intersection Observer for lazy loading
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        const img = entry.target as HTMLImageElement;
        if (entry.isIntersecting) {
          // Load high-res image
          if (img.dataset.src) {
            img.src = img.dataset.src;
          }
          observer.unobserve(img);
        }
      });
    });

    // Observe all images with data-src
    document.querySelectorAll('img[data-src]').forEach(img => {
      imageObserver.observe(img);
    });
  }
}

/**
 * Monitor page visibility and engagement
 */
export function trackEngagement() {
  let timeSpent = 0;
  let isActive = true;

  // Track time spent on page
  setInterval(() => {
    if (isActive) {
      timeSpent++;
    }
  }, 1000);

  // Detect when user leaves/returns
  document.addEventListener('visibilitychange', () => {
    isActive = !document.hidden;
    if (!isActive) {
      // Save time spent before upload
      console.log('📊 Time spent on page:', timeSpent, 'seconds');
    }
  });

  // Track scroll depth
  let scrollPercentage = 0;
  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    scrollPercentage = (scrollTop / docHeight) * 100;

    if (scrollPercentage > 25 && scrollPercentage < 26) {
      reportToAnalytics({
        name: 'scroll_25',
        value: 1
      });
    } else if (scrollPercentage > 50 && scrollPercentage < 51) {
      reportToAnalytics({
        name: 'scroll_50',
        value: 1
      });
    } else if (scrollPercentage > 75 && scrollPercentage < 76) {
      reportToAnalytics({
        name: 'scroll_75',
        value: 1
      });
    }
  });
}

/**
 * Track API response times
 */
export function trackAPIPerformance(endpoint: string, duration: number) {
  reportToAnalytics({
    name: `api_${endpoint}`,
    value: duration
  });

  if (duration > 3000) {
    console.warn(`⚠️ Slow API: ${endpoint} took ${duration}ms`);
  }
}

/**
 * Measure component render time
 */
export class PerformanceMonitor {
  private marks: Map<string, number> = new Map();

  start(label: string) {
    this.marks.set(label, performance.now());
  }

  end(label: string) {
    const startTime = this.marks.get(label);
    if (startTime) {
      const duration = performance.now() - startTime;
      console.log(`⏱️  ${label}: ${duration.toFixed(2)}ms`);
      this.marks.delete(label);
      return duration;
    }
    return 0;
  }

  measure(label: string, callback: () => void) {
    this.start(label);
    callback();
    return this.end(label);
  }
}

/**
 * Preload critical resources
 */
export function preloadCriticalResources() {
  // Preload fonts
  const fontLink = document.createElement('link');
  fontLink.rel = 'preload';
  fontLink.as = 'font';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
  fontLink.crossOrigin = 'anonymous';
  document.head.appendChild(fontLink);

  // DNS prefetch
  const dnsPrefetch = document.createElement('link');
  dnsPrefetch.rel = 'dns-prefetch';
  dnsPrefetch.href = 'https://www.googletagmanager.com';
  document.head.appendChild(dnsPrefetch);

  // Preconnect to critical domains
  const preconnect = document.createElement('link');
  preconnect.rel = 'preconnect';
  preconnect.href = 'https://www.google-analytics.com';
  document.head.appendChild(preconnect);
}

/**
 * Send performance data to server
 */
export function reportPerformanceMetrics(metrics: WebVitals) {
  // Only send in production
  if (process.env.NODE_ENV === 'production') {
    // Use sendBeacon to ensure delivery even if page unloads
    if (navigator.sendBeacon) {
      const data = JSON.stringify({
        metrics,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      });

      navigator.sendBeacon(
        '/api/analytics/metrics',
        data
      );
    }
  }
}

/**
 * Memory leak detection
 */
export function detectMemoryLeaks() {
  if ((performance as any).memory) {
    const used = (performance as any).memory.usedJSHeapSize;
    const limit = (performance as any).memory.jsHeapSizeLimit;
    const percentage = (used / limit) * 100;

    console.log(`💾 Memory: ${(used / 1048576).toFixed(2)}MB / ${(limit / 1048576).toFixed(2)}MB (${percentage.toFixed(1)}%)`);

    if (percentage > 90) {
      console.warn('⚠️ High memory usage detected!');
    }
  }
}

/**
 * Check if browser supports performance API
 */
export function hasPerformanceSupport(): boolean {
  return (
    typeof window !== 'undefined' &&
    'performance' in window &&
    'PerformanceObserver' in window
  );
}

/**
 * Get estimated page load time
 */
export function getPageLoadTime(): number {
  if (!hasPerformanceSupport()) return 0;

  const perfData = window.performance.timing;
  return perfData.loadEventEnd - perfData.navigationStart;
}

/**
 * Batch analytics updates to reduce requests
 */
class AnalyticsBatcher {
  private batch: any[] = [];
  private batchSize = 10;
  private timeout = 5000; // 5 seconds
  private timer: NodeJS.Timeout | null = null;

  add(event: any) {
    this.batch.push(event);
    if (this.batch.length >= this.batchSize) {
      this.flush();
    } else if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.timeout);
    }
  }

  private flush() {
    if (this.batch.length === 0) return;

    if (navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/analytics/batch',
        JSON.stringify(this.batch)
      );
    }

    this.batch = [];
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export const analyticsBatcher = new AnalyticsBatcher();
