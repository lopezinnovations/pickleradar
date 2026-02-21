import { useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

type SubscribeArgs = {
  table: string;
  filter?: string;
  event?: string; // '*', 'INSERT', 'UPDATE', 'DELETE'
  onUpdate?: () => void | Promise<void>;
  fallbackFetch?: () => void | Promise<void>;
};

export function useRealtimeManager(screenName: string) {
  return useMemo(() => {
    return {
      subscribe: (args: SubscribeArgs) => {
        if (!isSupabaseConfigured?.() || !supabase) {
          return () => {};
        }

        try {
          const channelName = `${screenName}:${args.table}:${args.filter ?? 'all'}`;
          const channel = supabase.channel(channelName);

          const changeConfig: { event: string; schema: string; table: string; filter?: string } = {
            event: args.event ?? '*',
            schema: 'public',
            table: args.table,
          };
          if (args.filter) {
            changeConfig.filter = args.filter;
          }

          channel.on(
            'postgres_changes',
            changeConfig,
            async () => {
              try {
                await args.onUpdate?.();
              } catch {
                try {
                  await args.fallbackFetch?.();
                } catch {
                  // ignore
                }
              }
            }
          );

          channel.subscribe();

          return () => {
            try {
              supabase.removeChannel(channel);
            } catch {
              // ignore
            }
          };
        } catch {
          return () => {};
        }
      },
    };
  }, [screenName]);
}
