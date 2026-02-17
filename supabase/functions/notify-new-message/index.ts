
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
  log('Push payload summary', { to: to.slice(0, 30) + '...', title, bodyLength: body.length });
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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      log('Skip: missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseServiceKey) {
      log('Skip: Supabase env not configured');
      return new Response(
        JSON.stringify({ error: 'Server misconfigured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      log('Skip: invalid or expired token', { error: authError?.message });
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = (await req.json()) as Payload;

    if (body.sender_id !== user.id) {
      log('Skip: caller is not sender', { caller: user.id, sender_id: body.sender_id });
      return new Response(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    log('Request received', {
      message_id: body.message_id,
      sender_id: body.sender_id,
      recipient_id: 'recipient_id' in body ? body.recipient_id : undefined,
      group_id: 'group_id' in body ? body.group_id : undefined,
    });

    if (body.type === 'direct') {
      const { message_id, sender_id, recipient_id, content, sender_name } = body;
      if (!sender_id || !recipient_id || !content) {
        log('Skip: missing required fields (direct)');
        return new Response(
          JSON.stringify({ error: 'Missing sender_id, recipient_id, or content' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: recipientUser, error: userErr } = await supabase
        .from('users')
        .select('id, notifications_enabled')
        .eq('id', recipient_id)
        .single();

      if (userErr || !recipientUser) {
        log('Skip: recipient lookup failed', { error: userErr?.message });
        return new Response(
          JSON.stringify({ error: 'Recipient lookup failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (recipientUser.notifications_enabled === false) {
        log('Skip: recipient has notifications disabled');
        return new Response(
          JSON.stringify({ skipped: 'notifications_disabled', message_id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let pushToken: string | undefined;
      let tokenRowId: string | undefined;

      const { data: tokenRows, error: tokenErr } = await supabase
        .from('push_tokens')
        .select('id, token')
        .eq('user_id', recipient_id)
        .eq('active', true)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (tokenErr) log('push_tokens lookup error', { recipient_id, error: tokenErr.message });
      pushToken = tokenRows?.[0]?.token;
      tokenRowId = tokenRows?.[0]?.id;
      log('Recipient token lookup (push_tokens)', {
        recipient_id,
        token_exists: !!pushToken?.trim(),
        token_prefix: pushToken?.slice(0, 28) ?? null,
      });

      if (!pushToken?.trim()) {
        const { data: legacyUser, error: legacyErr } = await supabase
          .from('users')
          .select('push_token')
          .eq('id', recipient_id)
          .single();
        if (legacyErr) log('users.push_token fallback error', { recipient_id, error: legacyErr.message });
        pushToken = legacyUser?.push_token ?? undefined;
        log('Recipient token lookup (fallback users.push_token)', {
          recipient_id,
          token_exists: !!pushToken?.trim(),
        });
      }

      if (!pushToken?.trim()) {
        log('Skip: token missing or empty (no active push_tokens for recipient)');
        return new Response(
          JSON.stringify({ skipped: 'token_missing', message_id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!isExpoToken(pushToken)) {
        log('Skip: token not in ExponentPushToken format', { prefix: pushToken?.slice(0, 30) });
        return new Response(
          JSON.stringify({ skipped: 'invalid_token_format', message_id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: mute } = await supabase
        .from('conversation_mutes')
        .select('muted_until')
        .eq('user_id', recipient_id)
        .eq('conversation_type', 'direct')
        .eq('conversation_id', sender_id)
        .maybeSingle();

      if (mute) {
        const mutedUntil = mute.muted_until;
        if (mutedUntil === null) {
          log('Skip: conversation muted until user unmutes');
          return new Response(
            JSON.stringify({ skipped: 'conversation_muted', message_id }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        if (new Date(mutedUntil) > new Date()) {
          log('Skip: conversation muted until', mutedUntil);
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
        pushToken,
        title,
        bodyText,
        { message_id, sender_id, recipient_id, conversation_type: 'direct' }
      );

      if (tokenRowId && shouldMarkTokenInactive(sendResult.error)) {
        const { error: markErr } = await supabase
          .from('push_tokens')
          .update({ active: false })
          .eq('id', tokenRowId);
        log('Marked token inactive (DeviceNotRegistered)', {
          token_row_id: tokenRowId,
          mark_error: markErr?.message,
        });
      }

      if (!sendResult.ok) {
        log('Push failed', { error: sendResult.error });
        return new Response(
          JSON.stringify({ error: 'Push send failed', detail: sendResult.error }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      log('Push sent successfully', { message_id, recipient_id });
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

      const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', group_id)
        .neq('user_id', sender_id);

      if (membersError || !members?.length) {
        log('Skip: no other members or lookup failed', { error: membersError?.message });
        return new Response(
          JSON.stringify({ success: true, sent: 0 }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const recipientIds = members.map((m) => m.user_id);
      const { data: recipientUsers } = await supabase
        .from('users')
        .select('id, notifications_enabled')
        .in('id', recipientIds);

      const { data: tokenRows } = await supabase
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
          const { data: legacy } = await supabase
            .from('users')
            .select('push_token')
            .eq('id', uid)
            .single();
          if (legacy?.push_token?.trim()) {
            tokensByUser.set(uid, { id: '', token: legacy.push_token });
          }
        }
      }

      const { data: mutes } = await supabase
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

      let sentCount = 0;
      for (const u of recipientUsers ?? []) {
        if (u.notifications_enabled === false) {
          log('Skip recipient (notifications disabled)', { recipient_id: u.id });
          continue;
        }
        const tokenInfo = tokensByUser.get(u.id);
        if (!tokenInfo?.token?.trim()) {
          log('Skip recipient (no token)', { recipient_id: u.id });
          continue;
        }
        if (!isExpoToken(tokenInfo.token)) {
          log('Skip recipient (invalid token format)', { recipient_id: u.id });
          continue;
        }
        const mute = muteMap.get(u.id);
        if (mute) {
          if (mute.muted_until === null) {
            log('Skip recipient (conversation muted)', { recipient_id: u.id });
            continue;
          }
          if (mute.muted_until && new Date(mute.muted_until) > new Date()) {
            log('Skip recipient (muted until)', { recipient_id: u.id, muted_until: mute.muted_until });
            continue;
          }
        }

        const sendResult = await sendExpoPush(
          tokenInfo.token,
          title,
          bodyText,
          { message_id, sender_id, group_id, recipient_id: u.id, conversation_type: 'group' }
        );
        if (sendResult.ok) sentCount++;
        if (tokenInfo.id && shouldMarkTokenInactive(sendResult.error)) {
          await supabase.from('push_tokens').update({ active: false }).eq('id', tokenInfo.id);
          log('Marked token inactive (DeviceNotRegistered)', { token_row_id: tokenInfo.id });
        }
      }

      log('Group push complete', { message_id, sent: sentCount });
      return new Response(
        JSON.stringify({ success: true, message_id, sent: sentCount }),
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
