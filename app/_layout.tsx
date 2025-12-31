
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
      
      if (event.url.startsWith('natively://magic-link')) {
        console.log('Magic link deep link detected');
        
        try {
          // Wait a moment for Supabase to process the session
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Check if we have a valid session
          const { data } = await supabase.auth.getSession();
          
          if (data.session) {
            console.log('Valid session found, navigating to home');
            console.log('User email:', data.session.user.email);
            
            // Navigate to home screen
            router.replace('/(tabs)/(home)');
          } else {
            console.log('No session found after magic link');
            router.replace('/auth');
          }
        } catch (error) {
          console.log('Error handling magic link:', error);
          router.replace('/auth');
        }
      }
    };

    // Listen for deep links while app is running
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
