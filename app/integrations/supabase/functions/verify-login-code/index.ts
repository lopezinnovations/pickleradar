
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { email, code } = await req.json();

    if (!email || !code) {
      return new Response(
        JSON.stringify({ error: 'Email and code are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find the most recent unused code for this email
    const { data: loginCode, error: fetchError } = await supabase
      .from('login_codes')
      .select('*')
      .eq('email', email)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !loginCode) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid or expired code',
          message: 'The code you entered is invalid or has expired. Please request a new code.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if max attempts exceeded
    if (loginCode.attempts >= loginCode.max_attempts) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Too many attempts',
          message: 'You have exceeded the maximum number of attempts. Please request a new code.',
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the code
    if (loginCode.code !== code) {
      // Increment attempts
      await supabase
        .from('login_codes')
        .update({ attempts: loginCode.attempts + 1 })
        .eq('id', loginCode.id);

      const remainingAttempts = loginCode.max_attempts - loginCode.attempts - 1;
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Invalid code',
          message: `The code you entered is incorrect. You have ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining.`,
          remainingAttempts,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark code as used
    await supabase
      .from('login_codes')
      .update({ used: true })
      .eq('id', loginCode.id);

    // Check if user exists
    const { data: existingUser } = await supabase.auth.admin.listUsers();
    const userExists = existingUser?.users?.some(u => u.email === email);

    if (!userExists) {
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'User not found',
          message: 'No account found with this email address. Please sign up first.',
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate a magic link token for the user
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    });

    if (linkError || !linkData) {
      console.error('Error generating auth link:', linkError);
      return new Response(
        JSON.stringify({ 
          success: false,
          error: 'Authentication failed',
          message: 'Failed to authenticate. Please try again.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return the session tokens
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Code verified successfully',
        access_token: linkData.properties.access_token,
        refresh_token: linkData.properties.refresh_token,
        expires_in: linkData.properties.expires_in,
        user: linkData.user,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in verify-login-code function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: 'Internal server error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
