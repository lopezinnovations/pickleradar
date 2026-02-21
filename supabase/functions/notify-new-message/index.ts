
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface DirectPayload {
  type: 'direct';
  message_id?: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  sender_name?: string;
}

interface GroupPayload {
  type: 'group';
  message_id?: string;
  sender_id: string;
  group_id: string;
  content: string;
  sender_name?: string;
}

type Payload = DirectPayload | GroupPayload;

function log(msg: string, data?: unknown) {
  const prefix = '[PUSH]';
  if (data !== undefined) {
    console.log(prefix, msg, JSON.stringify(data));
  } else {
    console.log(prefix, msg);
  }
}

/** Check if token is valid Expo format */
function isExpoToken(token: string): boolean {
  return typeof token === 'string' && token.startsWith('ExponentPushToken[') && token.endsWith(']');
}

/** Expo error code when device token is invalid (app uninstalled, token expired, etc.) */
function shouldMarkTokenInactive(errorMsg: string | undefined): boolean {
  return !!errorMsg && errorMsg.toLowerCase().includes('devicenotregistered');
}

/** Send a single push to Expo; returns response/error for logging */
async function sendExpoPush(
  to: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<{ ok: boolean; status?: number; result?: unknown; error?: string }> {
  const payload = {
    to,
    sound: 'default' as const,
    title,
    body,
    data: { type: 'new_message', ...data },
  };
  log('Push payload summary', { title, bodyLength: body.length });
  try {
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    log('Expo push response', { status: res.status, result });
    if (res.ok && result?.data?.[0]?.status === 'ok') {
      return { ok: true, status: res.status, result };
    }
    const errMsg = result?.data?.[0]?.message || result?.errors?.[0]?.message || 'Unknown';
    log('Expo push error (response)', { status: res.status, error: errMsg, fullResult: result });
    return { ok: false, status: res.status, result, error: errMsg };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    log('Expo push fetch error', { error: msg });
    return { ok: false, error: msg };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let request_id: string | undefined;
  try {
    const authHeader = req.headers.get('Authorization');
    const hasAuthHeader = !!authHeader;
    const bearerPrefixOk = !!authHeader && authHeader.startsWith('Bearer ');
    const rawBody = (await req.json()) as Record<string, unknown>;
    request_id = (rawBody?.request_id as string) ?? undefined;

    console.log('[EF notify-new-message] start', {
      request_id,
      hasAuthHeader,
      bearerPrefixOk,
    });

    if (!authHeader) {
      log('Skip: missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      log('Skip: Supabase env not configured', {
        hasUrl: !!supabaseUrl,
        hasAnonKey: !!supabaseAnonKey,
        hasServiceKey: !!supabaseServiceKey,
      });
      return new Response(
        JSON.stringify({ error: 'Server misconfigured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const jwt = bearerPrefixOk ? authHeader.slice(7).trim() : '';
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await authClient.auth.getUser(jwt);
    if (authError || !user) {
      log('Skip: invalid or expired token', { error: authError?.message });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const admin = createClient(supabaseUrl, supabaseServiceKey);

    function pickFirst(obj: Record<string, unknown>, keys: string[]): unknown {
      for (const k of keys) {
        const v = obj[k];
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return undefined;
    }
    let recipientId = pickFirst(rawBody, ['recipientId', 'recipient_id', 'toUserId', 'to_user_id', 'receiverId', 'receiver_id']) as string | undefined;
    let messagePreview = pickFirst(rawBody, ['messagePreview', 'message_preview', 'preview', 'body', 'text', 'message']) as string | undefined;
    let conversationType = (pickFirst(rawBody, ['conversationType', 'conversation_type']) as string) || 'direct';
    const groupName = pickFirst(rawBody, ['groupName', 'group_name']) as string | undefined;
    let messageId = pickFirst(rawBody, ['messageId', 'message_id']) as string | undefined;

    if ((!recipientId || !messagePreview) && messageId) {
      const { data: msgRow } = await admin.from('messages').select('recipient_id, content').eq('id', messageId).maybeSingle();
      if (msgRow) {
        const row = msgRow as Record<string, unknown>;
        if (!recipientId) recipientId = row.recipient_id as string | undefined;
        if (!messagePreview) messagePreview = ((row.content ?? '') as string).slice(0, 140);
      }
    }

    const body = rawBody as Payload;
    if (body.sender_id !== undefined && body.sender_id !== user.id) {
      log('Skip: caller is not sender', { caller: user.id, sender_id: body.sender_id });
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('Request received', {
      message_id: messageId ?? body.message_id,
      sender_id: user.id,
      recipient_id: recipientId ?? ('recipient_id' in body ? body.recipient_id : undefined),
      group_id: 'group_id' in body ? body.group_id : undefined,
    });

    if (body.type === 'direct' || (conversationType === 'direct' && recipientId)) {
      const recipient_id = recipientId ?? ('recipient_id' in body ? body.recipient_id : undefined);
      const content = messagePreview ?? ('content' in body ? body.content : undefined);
      const message_id = messageId ?? body.message_id;
      const sender_id = user.id;
      const sender_name = 'sender_name' in body ? body.sender_name : undefined;

      if (!recipient_id || !content) {
        const missingFields: string[] = [];
        if (!recipient_id) missingFields.push('recipientId');
        if (!content) missingFields.push('messagePreview');
        return new Response(
          JSON.stringify({
            error: 'Missing required fields',
            missingFields,
            receivedKeys: Object.keys(rawBody),
            hint: 'Send { recipientId, messagePreview, conversationType } or { messageId }',
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: recipientUser, error: userErr } = await admin
        .from('users')
        .select('id, push_token, notifications_enabled')
        .eq('id', recipient_id)
        .maybeSingle();

      if (userErr || !recipientUser) {
        log('Skip: recipient lookup failed', { error: userErr?.message });
        return new Response(
          JSON.stringify({ error: 'Recipient lookup failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (recipientUser.notifications_enabled === false) {
        log('Skip: recipient has notifications disabled');
        console.log('[EF notify-new-message] done', {
          request_id,
          recipients_count: 1,
          tokens_found_count: 0,
          mute_filtered_count: 0,
          sent_count: 0,
        });
        return new Response(
          JSON.stringify({ skipped: 'notifications_disabled', message_id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: friendPref } = await admin
        .from('friend_notification_preferences')
        .select('notify_messages')
        .eq('user_id', recipient_id)
        .eq('friend_id', user.id)
        .maybeSingle();
      if (friendPref && (friendPref as { notify_messages?: boolean }).notify_messages === false) {
        log('Skip: friend preference notify_messages off');
        console.log('[EF notify-new-message] done', {
          request_id,
          recipients_count: 1,
          tokens_found_count: 0,
          mute_filtered_count: 0,
          sent_count: 0,
        });
        return new Response(
          JSON.stringify({ skipped: 'friend_preference_off', message_id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let pushToken: string | undefined;
      let tokenRowId: string | undefined;

      const { data: tokenRows, error: tokenErr } = await admin
        .from('push_tokens')
        .select('id, token')
        .eq('user_id', recipient_id)
        .eq('active', true)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (tokenErr) log('push_tokens lookup error', { error: tokenErr.message });
      pushToken = tokenRows?.[0]?.token;
      tokenRowId = tokenRows?.[0]?.id;

      if (!pushToken?.trim()) {
        const { data: legacyUser, error: legacyErr } = await admin
          .from('users')
          .select('push_token')
          .eq('id', recipient_id)
          .single();
        if (legacyErr) log('users.push_token fallback error', { error: legacyErr.message });
        pushToken = legacyUser?.push_token ?? undefined;
      }

      const tokens_found_count = pushToken?.trim() && isExpoToken(pushToken) ? 1 : 0;
      if (tokens_found_count === 0) {
        log('Skip: token missing or invalid (no active push_tokens for recipient)');
        console.log('[EF notify-new-message] done', {
          request_id,
          recipients_count: 1,
          tokens_found_count: 0,
          mute_filtered_count: 0,
          sent_count: 0,
        });
        return new Response(
          JSON.stringify({ skipped: 'token_missing', message_id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: mute } = await admin
        .from('conversation_mutes')
        .select('muted_until')
        .eq('user_id', recipient_id)
        .eq('conversation_type', 'direct')
        .eq('conversation_id', sender_id)
        .maybeSingle();

      let mute_filtered_count = 0;
      if (mute) {
        const mutedUntil = mute.muted_until;
        if (mutedUntil === null) {
          mute_filtered_count = 1;
          log('Skip: conversation muted until user unmutes');
          console.log('[EF notify-new-message] done', {
            request_id,
            recipients_count: 1,
            tokens_found_count: 1,
            mute_filtered_count: 1,
            sent_count: 0,
          });
          return new Response(
            JSON.stringify({ skipped: 'conversation_muted', message_id }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (new Date(mutedUntil) > new Date()) {
          mute_filtered_count = 1;
          log('Skip: conversation muted until', mutedUntil);
          console.log('[EF notify-new-message] done', {
            request_id,
            recipients_count: 1,
            tokens_found_count: 1,
            mute_filtered_count: 1,
            sent_count: 0,
          });
          return new Response(
            JSON.stringify({ skipped: 'conversation_muted_until', message_id }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const displayName = sender_name || 'Someone';
      const title = displayName;
      const bodyText = content.length > 100 ? content.slice(0, 97) + '...' : content;

      const sendResult = await sendExpoPush(
        pushToken!,
        title,
        bodyText,
        { message_id, sender_id, recipient_id, conversation_type: 'direct' }
      );

      if (tokenRowId && shouldMarkTokenInactive(sendResult.error)) {
        await admin
          .from('push_tokens')
          .update({ active: false })
          .eq('id', tokenRowId);
      }

      const sent_count = sendResult.ok ? 1 : 0;
      console.log('[EF notify-new-message] done', {
        request_id,
        recipients_count: 1,
        tokens_found_count: 1,
        mute_filtered_count: 0,
        sent_count,
      });

      if (!sendResult.ok) {
        log('Push failed', { error: sendResult.error });
        return new Response(
          JSON.stringify({ skipped: 'push_send_failed', message_id, detail: sendResult.error }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message_id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (body.type === 'group') {
      const { message_id, sender_id, group_id, content, sender_name } = body;
      if (!sender_id || !group_id || !content) {
        log('Skip: missing required fields (group)');
        return new Response(
          JSON.stringify({ error: 'Missing sender_id, group_id, or content' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: members, error: membersError } = await admin
        .from('group_members')
        .select('user_id')
        .eq('group_id', group_id)
        .neq('user_id', sender_id);

      if (membersError || !members?.length) {
        log('Skip: no other members or lookup failed', { error: membersError?.message });
        console.log('[EF notify-new-message] done', {
          request_id,
          recipients_count: 0,
          tokens_found_count: 0,
          mute_filtered_count: 0,
          sent_count: 0,
        });
        return new Response(
          JSON.stringify({ success: true, sent: 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const recipientIds = members.map((m) => m.user_id);
      const recipients_count = recipientIds.length;

      const { data: recipientUsers } = await admin
        .from('users')
        .select('id, notifications_enabled')
        .in('id', recipientIds);

      const { data: tokenRows } = await admin
        .from('push_tokens')
        .select('id, user_id, token')
        .in('user_id', recipientIds)
        .eq('active', true)
        .order('updated_at', { ascending: false });

      const tokensByUser = new Map<string, { id: string; token: string }>();
      for (const row of tokenRows ?? []) {
        if (!tokensByUser.has(row.user_id)) {
          tokensByUser.set(row.user_id, { id: row.id, token: row.token });
        }
      }
      for (const uid of recipientIds) {
        if (!tokensByUser.has(uid)) {
          const { data: legacy } = await admin
            .from('users')
            .select('push_token')
            .eq('id', uid)
            .single();
          if (legacy?.push_token?.trim()) {
            tokensByUser.set(uid, { id: '', token: legacy.push_token });
          }
        }
      }

      const { data: mutes } = await admin
        .from('conversation_mutes')
        .select('user_id, muted_until')
        .eq('conversation_type', 'group')
        .eq('conversation_id', group_id);

      const muteMap = new Map<string, { muted_until: string | null }>();
      for (const m of mutes ?? []) {
        muteMap.set(m.user_id, { muted_until: m.muted_until });
      }

      const displayName = sender_name || 'Someone';
      const title = displayName;
      const bodyText = content.length > 100 ? content.slice(0, 97) + '...' : content;

      let tokens_found_count = 0;
      let mute_filtered_count = 0;
      let sent_count = 0;
      for (const u of recipientUsers ?? []) {
        if (u.notifications_enabled === false) {
          continue;
        }
        const tokenInfo = tokensByUser.get(u.id);
        if (!tokenInfo?.token?.trim()) {
          continue;
        }
        if (!isExpoToken(tokenInfo.token)) {
          continue;
        }
        tokens_found_count++;
        const mute = muteMap.get(u.id);
        if (mute) {
          if (mute.muted_until === null) {
            mute_filtered_count++;
            continue;
          }
          if (mute.muted_until && new Date(mute.muted_until) > new Date()) {
            mute_filtered_count++;
            continue;
          }
        }

        const sendResult = await sendExpoPush(
          tokenInfo.token,
          title,
          bodyText,
          { message_id, sender_id, group_id, recipient_id: u.id, conversation_type: 'group' }
        );
        if (sendResult.ok) sent_count++;
        if (tokenInfo.id && shouldMarkTokenInactive(sendResult.error)) {
          await admin.from('push_tokens').update({ active: false }).eq('id', tokenInfo.id);
        }
      }

      console.log('[EF notify-new-message] done', {
        request_id,
        recipients_count,
        tokens_found_count,
        mute_filtered_count,
        sent_count,
      });

      return new Response(
        JSON.stringify({ success: true, message_id, sent: sent_count }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('Skip: invalid type');
    return new Response(
      JSON.stringify({ error: 'Invalid type' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[PUSH] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
