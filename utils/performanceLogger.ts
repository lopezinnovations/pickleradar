
/**
 * Performance Logging Utility
 * 
 * Tracks screen lifecycle events, Supabase queries, and realtime subscriptions.
 * 
 * Usage:
 * 1. Set debugPerf = true to enable logging (default)
 * 2. Import and use logPerformance() for manual events
 * 3. Use logSupabaseQuery() wrapper for automatic query tracking
 * 4. Call printPerformanceSummary() to see results
 * 
 * Events tracked:
 * - SCREEN_FOCUS: When screen comes into focus
 * - QUERY_START/QUERY_END: Query lifecycle
 * - RENDER_COMPLETE: When screen finishes rendering
 * - SUPABASE_CALL: Supabase query with duration and row count
 * - REALTIME_SUBSCRIBE/UNSUBSCRIBE: Realtime channel lifecycle
 * 
 * Example:
 *   logPerformance('SCREEN_FOCUS', 'MapScreen');
 *   const result = await logSupabaseQuery(supabase.from('courts').select('*'), 'MapScreen', 'courts.select');
 *   logPerformance('RENDER_COMPLETE', 'MapScreen', undefined, { courtsCount: 10 });
 * 
 * To view summary:
 *   printPerformanceSummary() // Call from console or code
 */

// Global flag to enable/disable performance logging
export const debugPerf = true;

type PerfLogType = 
  | 'SCREEN_FOCUS' 
  | 'QUERY_START' 
  | 'QUERY_END' 
  | 'RENDER_COMPLETE' 
  | 'SUPABASE_CALL' 
  | 'REALTIME_SUBSCRIBE' 
  | 'REALTIME_UNSUBSCRIBE';

interface PerformanceLogEntry {
  type: PerfLogType;
  screen?: string;
  name?: string;
  timestamp: number;
  duration?: number;
  details?: Record<string, any>;
}

const performanceLogs: PerformanceLogEntry[] = [];

// Log a performance event
export const logPerformance = (
  type: PerfLogType,
  screen?: string,
  name?: string,
  details?: Record<string, any>
) => {
  if (!debugPerf) return;

  const timestamp = performance.now();
  const logEntry: PerformanceLogEntry = { type, timestamp, screen, name, details };

  // Calculate duration for end events
  if (type === 'QUERY_END' || type === 'SUPABASE_CALL' || type === 'REALTIME_UNSUBSCRIBE') {
    const startEntry = performanceLogs.find(
      (entry) =>
        entry.screen === screen &&
        entry.name === name &&
        (entry.type === 'QUERY_START' || entry.type === 'REALTIME_SUBSCRIBE') &&
        entry.duration === undefined
    );
    if (startEntry) {
      logEntry.duration = timestamp - startEntry.timestamp;
      startEntry.duration = logEntry.duration;
    }
  }

  performanceLogs.push(logEntry);
  
  const durationStr = logEntry.duration !== undefined ? ` (${logEntry.duration.toFixed(2)}ms)` : '';
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`⏱️ PERF [${type}] ${screen || ''}${name ? ` - ${name}` : ''}${durationStr}${detailsStr}`);
};

// Wrapper for Supabase queries with automatic logging
export const logSupabaseQuery = async <T>(
  queryPromise: Promise<{ data: T | null; error: any; count?: number | null }>,
  screen: string,
  queryName: string
) => {
  if (!debugPerf) {
    return await queryPromise;
  }

  const startTime = performance.now();
  
  try {
    const result = await queryPromise;
    const { data, error, count } = result;
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const rowCount = Array.isArray(data) ? data.length : (data ? 1 : 0);
    
    logPerformance('SUPABASE_CALL', screen, queryName, { 
      duration: duration.toFixed(2),
      rows: rowCount, 
      count, 
      hasError: !!error 
    });
    
    if (error) {
      console.error(`❌ SUPABASE_ERROR [${screen}] ${queryName}:`, error);
    }
    
    return result;
  } catch (err) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.error(`❌ SUPABASE_EXCEPTION [${screen}] ${queryName}:`, err);
    logPerformance('SUPABASE_CALL', screen, queryName, { 
      duration: duration.toFixed(2),
      exception: true 
    });
    throw err;
  }
};

// Get performance summary with worst offenders
export const getPerformanceSummary = () => {
  if (!debugPerf) return { summary: {}, worstOffender: null };

  const summary: Record<string, { 
    totalDuration: number; 
    calls: number; 
    worstCall: { name: string; duration: number } | null 
  }> = {};

  performanceLogs.forEach(log => {
    if (log.screen && log.duration !== undefined) {
      if (!summary[log.screen]) {
        summary[log.screen] = { totalDuration: 0, calls: 0, worstCall: null };
      }
      summary[log.screen].totalDuration += log.duration;
      summary[log.screen].calls++;

      if (log.name && log.type === 'SUPABASE_CALL') {
        if (!summary[log.screen].worstCall || log.duration > summary[log.screen].worstCall!.duration) {
          summary[log.screen].worstCall = { name: log.name, duration: log.duration };
        }
      }
    }
  });

  let worstScreen: string | null = null;
  let maxScreenDuration = 0;

  for (const screen in summary) {
    if (summary[screen].totalDuration > maxScreenDuration) {
      maxScreenDuration = summary[screen].totalDuration;
      worstScreen = screen;
    }
  }

  return {
    summary,
    worstOffender: worstScreen ? {
      screen: worstScreen,
      details: summary[worstScreen],
    } : null,
  };
};

// Print performance summary to console
export const printPerformanceSummary = () => {
  if (!debugPerf) {
    console.log('⏱️ PERF: Performance logging is disabled (debugPerf = false)');
    return;
  }

  const { summary, worstOffender } = getPerformanceSummary();
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('⏱️ PERFORMANCE SUMMARY');
  console.log('═══════════════════════════════════════════════════════\n');
  
  Object.entries(summary).forEach(([screen, data]) => {
    console.log(`📱 ${screen}:`);
    console.log(`   Total Duration: ${data.totalDuration.toFixed(2)}ms`);
    console.log(`   Total Calls: ${data.calls}`);
    if (data.worstCall) {
      console.log(`   Worst Call: ${data.worstCall.name} (${data.worstCall.duration.toFixed(2)}ms)`);
    }
    console.log('');
  });
  
  if (worstOffender) {
    console.log('🔥 WORST OFFENDER:');
    console.log(`   Screen: ${worstOffender.screen}`);
    console.log(`   Total Duration: ${worstOffender.details.totalDuration.toFixed(2)}ms`);
    console.log(`   Total Calls: ${worstOffender.details.calls}`);
    if (worstOffender.details.worstCall) {
      console.log(`   Slowest Call: ${worstOffender.details.worstCall.name} (${worstOffender.details.worstCall.duration.toFixed(2)}ms)`);
    }
  }
  
  console.log('\n═══════════════════════════════════════════════════════\n');
};

// Legacy exports for backward compatibility
export const startPerformanceTrack = (key: string, details?: any) => {
  if (!debugPerf) return performance.now();
  
  const timestamp = performance.now();
  console.log(`⏱️ PERF_START: ${key}`, details ? `- ${JSON.stringify(details)}` : '');
  return timestamp;
};

export const endPerformanceTrack = (key: string, details?: any) => {
  if (!debugPerf) return null;
  
  const endTime = performance.now();
  const durationFormatted = '0.00'; // We don't track start time in new system
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`✅ PERF_END: ${key} - Duration: ${durationFormatted}ms${detailsStr}`);
  return 0;
};

export const clearPerformanceLogs = () => {
  performanceLogs.length = 0;
};

// Export for global access (can be called from console)
if (typeof global !== 'undefined') {
  (global as any).printPerformanceSummary = printPerformanceSummary;
  (global as any).getPerformanceSummary = getPerformanceSummary;
  (global as any).clearPerformanceLogs = clearPerformanceLogs;
}

// ============================================
// CACHING UTILITIES
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

/**
 * Get cached data if it exists and is not expired
 * @param key Cache key
 * @param maxAgeMs Maximum age in milliseconds (default: 60 seconds)
 * @returns Cached data or null if not found/expired
 */
export function getCachedData<T>(key: string, maxAgeMs: number = 60000): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > maxAgeMs) {
    memoryCache.delete(key);
    return null;
  }
  
  console.log(`📦 CACHE HIT: ${key} (age: ${age}ms)`);
  return entry.data as T;
}

/**
 * Set cached data
 * @param key Cache key
 * @param data Data to cache
 */
export function setCachedData<T>(key: string, data: T): void {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
  });
  console.log(`📦 CACHE SET: ${key}`);
}

/**
 * Clear cached data
 * @param key Optional cache key to clear specific entry, or clear all if not provided
 */
export function clearCache(key?: string): void {
  if (key) {
    memoryCache.delete(key);
    console.log(`📦 CACHE CLEAR: ${key}`);
  } else {
    memoryCache.clear();
    console.log('📦 CACHE CLEAR: All');
  }
}

// ============================================
// DEBOUNCE UTILITY
// ============================================

/**
 * Debounce a function call
 * @param func Function to debounce
 * @param waitMs Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, waitMs);
  };
}
