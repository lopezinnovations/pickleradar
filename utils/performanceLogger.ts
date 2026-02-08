
// Performance logging utility for tracking screen load times and query performance

interface PerformanceLogEntry {
  start?: number;
  end?: number;
  duration?: number;
  details?: any;
}

const performanceLogs: { [key: string]: PerformanceLogEntry } = {};

export const startPerformanceTrack = (key: string, details?: any) => {
  const timestamp = performance.now();
  performanceLogs[key] = { start: timestamp, details };
  console.log(`⏱️ PERF_START: ${key}`, details ? `- ${JSON.stringify(details)}` : '');
  return timestamp;
};

export const endPerformanceTrack = (key: string, details?: any) => {
  const endTime = performance.now();
  
  if (performanceLogs[key] && performanceLogs[key].start) {
    const duration = endTime - performanceLogs[key].start!;
    performanceLogs[key].end = endTime;
    performanceLogs[key].duration = duration;
    
    const durationFormatted = duration.toFixed(2);
    const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
    console.log(`✅ PERF_END: ${key} - Duration: ${durationFormatted}ms${detailsStr}`);
    
    return duration;
  }
  
  console.warn(`⚠️ PERF_WARN: End track called for '${key}' without a start.`);
  return null;
};

export const logSupabaseQuery = async <T>(
  queryPromise: Promise<{ data: T | null; error: any; count?: number | null }>,
  queryName: string
) => {
  const startTime = startPerformanceTrack(`SupabaseQuery:${queryName}`);
  
  try {
    const result = await queryPromise;
    const { data, error, count } = result;
    
    const rowCount = Array.isArray(data) ? data.length : (data ? 1 : 0);
    const duration = endPerformanceTrack(`SupabaseQuery:${queryName}`, { 
      rows: rowCount, 
      count, 
      hasError: !!error 
    });
    
    if (error) {
      console.error(`❌ SupabaseQueryError:${queryName}`, error);
    }
    
    return { data, error, count, duration };
  } catch (err) {
    console.error(`❌ SupabaseQueryException:${queryName}`, err);
    endPerformanceTrack(`SupabaseQuery:${queryName}`, { exception: true });
    throw err;
  }
};

export const clearPerformanceLogs = () => {
  Object.keys(performanceLogs).forEach(key => delete performanceLogs[key]);
};

export const getPerformanceSummary = () => {
  return Object.entries(performanceLogs)
    .filter(([_, entry]) => entry.duration !== undefined)
    .map(([key, entry]) => ({
      key,
      duration: entry.duration,
      details: entry.details
    }))
    .sort((a, b) => (b.duration || 0) - (a.duration || 0));
};
