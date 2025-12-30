
import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/app/integrations/supabase/client';

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    // Handle deep links for magic link authentication
    const handleDeepLink = async (event: { url: string }) => {
      console.log('Deep link received:', event.url);
      
      try {
        // Parse the URL
        const url = Linking.parse(event.url);
        console.log('Parsed URL:', url);
        console.log('URL path:', url.path);
        console.log('URL hostname:', url.hostname);
        console.log('URL queryParams:', url.queryParams);
        
        // Check if this is a magic link
        if (url.path === 'magic-link' || url.hostname === 'magic-link') {
          console.log('Magic link deep link detected');
          
          // Extract tokens from URL fragment or query params
          // Supabase sends tokens in the URL fragment (after #)
          const fullUrl = event.url;
          let accessToken: string | null = null;
          let refreshToken: string | null = null;
          let expiresIn: string | null = null;
          let tokenType: string | null = null;
          
          // Try to extract from fragment (after #)
          if (fullUrl.includes('#')) {
            const fragmentPart = fullUrl.split('#')[1];
            const fragmentParams = new URLSearchParams(fragmentPart);
            
            accessToken = fragmentParams.get('access_token');
            refreshToken = fragmentParams.get('refresh_token');
            expiresIn = fragmentParams.get('expires_in');
            tokenType = fragmentParams.get('token_type');
            
            console.log('Extracted from fragment:');
            console.log('- access_token:', accessToken ? 'present' : 'missing');
            console.log('- refresh_token:', refreshToken ? 'present' : 'missing');
            console.log('- expires_in:', expiresIn);
            console.log('- token_type:', tokenType);
          }
          
          // Also check query params as fallback
          if (!accessToken && url.queryParams) {
            accessToken = url.queryParams.access_token as string || null;
            refreshToken = url.queryParams.refresh_token as string || null;
            expiresIn = url.queryParams.expires_in as string || null;
            tokenType = url.queryParams.token_type as string || null;
            
            console.log('Extracted from query params:');
            console.log('- access_token:', accessToken ? 'present' : 'missing');
            console.log('- refresh_token:', refreshToken ? 'present' : 'missing');
            console.log('- expires_in:', expiresIn);
            console.log('- token_type:', tokenType);
          }
          
          // If we have tokens, set the session
          if (accessToken && refreshToken) {
            console.log('Setting session with extracted tokens...');
            
            const { data, error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (error) {
              console.log('Error setting session:', error);
              router.replace('/magic-link?error=session_failed');
              return;
            }
            
            if (data.session) {
              console.log('Session set successfully');
              console.log('User email:', data.session.user.email);
              
              // Navigate to magic-link screen which will show success message and redirect
              router.replace('/magic-link?success=true');
              return;
            } else {
              console.log('No session returned after setSession');
              router.replace('/magic-link?error=no_session');
              return;
            }
          } else {
            console.log('No tokens found in URL, checking existing session...');
            
            // Wait a moment for the session to be established
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Verify we have a valid session
            const { data: { session }, error } = await supabase.auth.getSession();
            
            if (error) {
              console.log('Error getting session:', error);
              router.replace('/magic-link?error=session_check_failed');
            } else if (session) {
              console.log('Valid session found for magic link');
              console.log('User email:', session.user.email);
              
              // Navigate to magic-link screen which will show success message and redirect
              router.replace('/magic-link?success=true');
            } else {
              console.log('No session found - user may need to click the link again');
              router.replace('/magic-link?error=no_session');
            }
          }
          return;
        }
      } catch (error) {
        console.log('Error handling deep link:', error);
        router.replace('/magic-link?error=exception');
      }
    };

    // Listen for deep links
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // Check if app was opened with a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('App opened with URL:', url);
        handleDeepLink({ url });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="welcome" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="magic-link" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
