
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
      
      // Parse the URL
      const url = Linking.parse(event.url);
      console.log('Parsed URL:', url);
      console.log('URL path:', url.path);
      console.log('URL hostname:', url.hostname);
      
      // Check if this is a magic link
      if (url.path === 'magic-link' || url.hostname === 'magic-link') {
        console.log('Magic link deep link detected');
        
        // Wait a moment for the session to be established
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verify we have a valid session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.log('Error getting session:', error);
          // Navigate to magic-link screen which will handle the error
          router.replace('/magic-link');
        } else if (session) {
          console.log('Valid session found for magic link');
          console.log('User email:', session.user.email);
          
          // Navigate to magic-link screen which will show success message and redirect
          router.replace('/magic-link');
        } else {
          console.log('No session found - user may need to click the link again');
          // Navigate to magic-link screen which will handle the flow
          router.replace('/magic-link');
        }
        return;
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
