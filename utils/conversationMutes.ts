import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';


export type ConversationType = 'direct' | 'group';

export function computeMutedUntil(minutes: number | null): string | null {
  if (minutes === null) return null; // until turned back on
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  return now.toISOString();
}

export async function setConversationMute(params: {
  userId: string;
  conversationType: ConversationType;
  conversationId: string; // uuid for group, user uuid for direct (your schema uses uuid)
  minutes: number | null;
}) {
  const { userId, conversationType, conversationId, minutes } = params;

  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

  const mutedUntil = computeMutedUntil(minutes);

  const { error } = await supabase.from('conversation_mutes').upsert(
    {
      user_id: userId,
      conversation_type: conversationType,
      conversation_id: conversationId,
      muted_until: mutedUntil,
    },
    { onConflict: 'user_id,conversation_type,conversation_id' }
  );

  if (error) return { success: false, error: error.message };
  return { success: true as const };
}

export async function unmuteConversation(params: {
  userId: string;
  conversationType: ConversationType;
  conversationId: string;
}) {
  const { userId, conversationType, conversationId } = params;

  if (!isSupabaseConfigured()) return { success: false, error: 'Supabase not configured' };

  const { error } = await supabase
    .from('conversation_mutes')
    .delete()
    .eq('user_id', userId)
    .eq('conversation_type', conversationType)
    .eq('conversation_id', conversationId);

  if (error) return { success: false, error: error.message };
  return { success: true as const };
}
