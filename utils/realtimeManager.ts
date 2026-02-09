
/**
 * Realtime Subscription Manager
 * 
 * Provides robust realtime subscription management with:
 * - Single subscription per screen (prevents duplicates)
 * - Automatic unsubscribe on unmount/blur
 * - Fallback to normal fetch if realtime fails/times out
 * - Narrow filters to avoid subscribing to large tables
 * - Exponential backoff for retries with cap
 * - Comprehensive logging and error handling
 * 
 * Usage:
 * 
 * const manager = useRealtimeManager('MessagesScreen');
 * 
 * useEffect(() => {
 *   const unsubscribe = manager.subscribe({
 *     table: 'messages',
 *     filter: `sender_id=eq.${userId}`,
 *     onUpdate: () => fetchMessages(),
 *     fallbackFetch: fetchMessages,
 *   });
 *   return unsubscribe;
 * }, [userId]);
 */

import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { logPerformance } from './performanceLogger';
import React from 'react';

interface SubscriptionConfig {
  table: string;
  filter?: string; // REQUIRED for large tables (e.g., "court_id=eq.123")
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  onUpdate: () => void | Promise<void>;
  fallbackFetch: () => void | Promise<void>;
  timeoutMs?: number; // Default: 10000 (10 seconds)
  maxRetries?: number; // Default: 3
}

interface ActiveSubscription {
  channel: RealtimeChannel;
  config: SubscriptionConfig;
  retryCount: number;
  retryTimeout?: NodeJS.Timeout;
  isActive: boolean;
}

class RealtimeManager {
  private subscriptions: Map<string, ActiveSubscription> = new Map();
  private screenName: string;

  constructor(screenName: string) {
    this.screenName = screenName;
  }

  /**
   * Subscribe to realtime updates with automatic fallback and retry logic
   * Returns an unsubscribe function
   */
  subscribe(config: SubscriptionConfig): () => void {
    if (!isSupabaseConfigured()) {
      console.log(`[${this.screenName}] Supabase not configured, using fallback fetch only`);
      config.fallbackFetch();
      return () => {}; // No-op unsubscribe
    }

    const {
      table,
      filter,
      event = '*',
      onUpdate,
      fallbackFetch,
      timeoutMs = 10000,
      maxRetries = 3,
    } = config;

    // Validate filter for large tables
    const largeTables = ['messages', 'group_messages', 'check_ins', 'courts', 'users'];
    if (largeTables.includes(table) && !filter) {
      console.warn(
        `[${this.screenName}] ⚠️ WARNING: Subscribing to large table "${table}" without filter. ` +
        `This may cause performance issues. Consider adding a filter (e.g., "user_id=eq.123").`
      );
    }

    const subscriptionKey = `${table}_${filter || 'all'}_${event}`;

    // Check if already subscribed
    if (this.subscriptions.has(subscriptionKey)) {
      console.log(`[${this.screenName}] Already subscribed to ${subscriptionKey}, skipping duplicate`);
      return () => this.unsubscribe(subscriptionKey);
    }

    console.log(`[${this.screenName}] Setting up realtime subscription: ${subscriptionKey}`);
    logPerformance('REALTIME_SUBSCRIBE', this.screenName, subscriptionKey);

    // Create subscription
    this.createSubscription(subscriptionKey, config, 0);

    // Return unsubscribe function
    return () => this.unsubscribe(subscriptionKey);
  }

  private createSubscription(
    subscriptionKey: string,
    config: SubscriptionConfig,
    retryCount: number
  ) {
    const { table, filter, event = '*', onUpdate, fallbackFetch, timeoutMs = 10000, maxRetries = 3 } = config;

    // Create channel with unique name
    const channelName = `${this.screenName}_${subscriptionKey}_${Date.now()}`;
    const channel = supabase.channel(channelName);

    // Set up timeout for subscription
    const timeoutId = setTimeout(() => {
      console.error(
        `[${this.screenName}] ⏱️ Realtime subscription timed out after ${timeoutMs}ms: ${subscriptionKey}`
      );
      logPerformance('REALTIME_SUBSCRIBE', this.screenName, subscriptionKey, {
        status: 'timeout',
        retryCount,
      });

      // Use fallback fetch
      console.log(`[${this.screenName}] Using fallback fetch for ${subscriptionKey}`);
      fallbackFetch();

      // Retry with exponential backoff if under max retries
      if (retryCount < maxRetries) {
        this.scheduleRetry(subscriptionKey, config, retryCount);
      } else {
        console.error(
          `[${this.screenName}] ❌ Max retries (${maxRetries}) reached for ${subscriptionKey}. ` +
          `Continuing with fallback fetch only.`
        );
        // Keep subscription in map but mark as inactive
        const sub = this.subscriptions.get(subscriptionKey);
        if (sub) {
          sub.isActive = false;
        }
      }
    }, timeoutMs);

    // Configure postgres_changes listener
    const changeConfig: any = {
      event,
      schema: 'public',
      table,
    };

    if (filter) {
      changeConfig.filter = filter;
    }

    channel.on('postgres_changes', changeConfig, (payload) => {
      console.log(`[${this.screenName}] Realtime update received for ${subscriptionKey}:`, payload.eventType);
      
      // Clear timeout since we received data
      clearTimeout(timeoutId);
      
      // Mark as active
      const sub = this.subscriptions.get(subscriptionKey);
      if (sub) {
        sub.isActive = true;
        sub.retryCount = 0; // Reset retry count on successful update
      }

      // Call update handler
      onUpdate();
    });

    // Subscribe and handle status
    channel.subscribe((status, err) => {
      console.log(`[${this.screenName}] Subscription status for ${subscriptionKey}:`, status);

      if (status === 'SUBSCRIBED') {
        clearTimeout(timeoutId);
        console.log(`[${this.screenName}] ✅ Successfully subscribed to ${subscriptionKey}`);
        logPerformance('REALTIME_SUBSCRIBE', this.screenName, subscriptionKey, {
          status: 'success',
          retryCount,
        });

        // Mark as active
        const sub = this.subscriptions.get(subscriptionKey);
        if (sub) {
          sub.isActive = true;
          sub.retryCount = 0;
        }
      } else if (status === 'CHANNEL_ERROR') {
        clearTimeout(timeoutId);
        console.error(`[${this.screenName}] ❌ Channel error for ${subscriptionKey}:`, err);
        logPerformance('REALTIME_SUBSCRIBE', this.screenName, subscriptionKey, {
          status: 'error',
          error: err,
          retryCount,
        });

        // Use fallback fetch
        console.log(`[${this.screenName}] Using fallback fetch for ${subscriptionKey}`);
        fallbackFetch();

        // Retry with exponential backoff if under max retries
        if (retryCount < maxRetries) {
          this.scheduleRetry(subscriptionKey, config, retryCount);
        } else {
          console.error(
            `[${this.screenName}] ❌ Max retries (${maxRetries}) reached for ${subscriptionKey}. ` +
            `Continuing with fallback fetch only.`
          );
        }
      } else if (status === 'TIMED_OUT') {
        clearTimeout(timeoutId);
        console.error(`[${this.screenName}] ⏱️ Subscription timed out for ${subscriptionKey}`);
        logPerformance('REALTIME_SUBSCRIBE', this.screenName, subscriptionKey, {
          status: 'timeout',
          retryCount,
        });

        // Use fallback fetch
        fallbackFetch();

        // Retry if under max retries
        if (retryCount < maxRetries) {
          this.scheduleRetry(subscriptionKey, config, retryCount);
        }
      } else if (status === 'CLOSED') {
        clearTimeout(timeoutId);
        console.log(`[${this.screenName}] Channel closed for ${subscriptionKey}`);
      }
    });

    // Store subscription
    this.subscriptions.set(subscriptionKey, {
      channel,
      config,
      retryCount,
      isActive: false, // Will be set to true on successful subscription
    });
  }

  private scheduleRetry(subscriptionKey: string, config: SubscriptionConfig, retryCount: number) {
    // Exponential backoff: 2^retryCount * 1000ms (1s, 2s, 4s, 8s, ...)
    const backoffMs = Math.pow(2, retryCount) * 1000;
    const maxBackoffMs = 30000; // Cap at 30 seconds
    const delayMs = Math.min(backoffMs, maxBackoffMs);

    console.log(
      `[${this.screenName}] Scheduling retry ${retryCount + 1} for ${subscriptionKey} in ${delayMs}ms`
    );

    const sub = this.subscriptions.get(subscriptionKey);
    if (sub) {
      // Clear existing retry timeout if any
      if (sub.retryTimeout) {
        clearTimeout(sub.retryTimeout);
      }

      // Schedule retry
      sub.retryTimeout = setTimeout(() => {
        console.log(`[${this.screenName}] Retrying subscription ${subscriptionKey} (attempt ${retryCount + 1})`);
        
        // Unsubscribe old channel
        sub.channel.unsubscribe();
        
        // Create new subscription with incremented retry count
        this.createSubscription(subscriptionKey, config, retryCount + 1);
      }, delayMs);
    }
  }

  /**
   * Unsubscribe from a specific subscription
   */
  unsubscribe(subscriptionKey: string) {
    const sub = this.subscriptions.get(subscriptionKey);
    if (!sub) {
      console.log(`[${this.screenName}] No active subscription found for ${subscriptionKey}`);
      return;
    }

    console.log(`[${this.screenName}] Unsubscribing from ${subscriptionKey}`);
    logPerformance('REALTIME_UNSUBSCRIBE', this.screenName, subscriptionKey);

    // Clear retry timeout if any
    if (sub.retryTimeout) {
      clearTimeout(sub.retryTimeout);
    }

    // Unsubscribe channel
    sub.channel.unsubscribe();

    // Remove from map
    this.subscriptions.delete(subscriptionKey);
  }

  /**
   * Unsubscribe from all subscriptions for this screen
   */
  unsubscribeAll() {
    console.log(`[${this.screenName}] Unsubscribing from all subscriptions`);
    
    for (const [key, sub] of this.subscriptions.entries()) {
      logPerformance('REALTIME_UNSUBSCRIBE', this.screenName, key);
      
      if (sub.retryTimeout) {
        clearTimeout(sub.retryTimeout);
      }
      
      sub.channel.unsubscribe();
    }

    this.subscriptions.clear();
  }

  /**
   * Get status of all subscriptions
   */
  getStatus() {
    const status: Record<string, { isActive: boolean; retryCount: number }> = {};
    
    for (const [key, sub] of this.subscriptions.entries()) {
      status[key] = {
        isActive: sub.isActive,
        retryCount: sub.retryCount,
      };
    }

    return status;
  }
}

/**
 * React hook for managing realtime subscriptions
 * Automatically cleans up on unmount
 */
export const useRealtimeManager = (screenName: string) => {
  const managerRef = React.useRef<RealtimeManager | null>(null);

  if (!managerRef.current) {
    managerRef.current = new RealtimeManager(screenName);
  }

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (managerRef.current) {
        managerRef.current.unsubscribeAll();
      }
    };
  }, []);

  return managerRef.current;
};

// For non-React usage
export { RealtimeManager };
