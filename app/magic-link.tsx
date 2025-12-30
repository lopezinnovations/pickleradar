
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/app/integrations/supabase/client';
import { BrandingFooter } from '@/components/BrandingFooter';

export default function MagicLinkScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string | null>(null);
  const [pickleballerNickname, setPickleballerNickname] = useState<string | null>(null);

  useEffect(() => {
    handleMagicLink();
  }, []);

  const handleMagicLink = async () => {
    console.log('MagicLinkScreen: Handling magic link authentication...');
    console.log('MagicLinkScreen: Params:', params);
    
    try {
      // Check if there was an error passed via params
      if (params.error) {
        console.log('MagicLinkScreen: Error from deep link handler:', params.error);
        setError(getErrorMessage(params.error as string));
        setVerifying(false);
        setTimeout(() => {
          router.replace('/auth');
        }, 3000);
        return;
      }
      
      // Wait a moment for the session to be fully established
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check if user is now authenticated
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.log('MagicLinkScreen: Error getting session:', sessionError);
        throw sessionError;
      }

      if (session?.user) {
        console.log('MagicLinkScreen: User authenticated successfully:', session.user.email);
        
        // Fetch user profile to get first name and nickname
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('first_name, pickleballer_nickname')
          .eq('id', session.user.id)
          .single();
        
        if (profileError) {
          console.log('MagicLinkScreen: Error fetching profile:', profileError);
          // Don't fail if profile fetch fails, just continue without name
        } else if (profile) {
          console.log('MagicLinkScreen: Profile fetched successfully');
          setFirstName(profile.first_name);
          setPickleballerNickname(profile.pickleballer_nickname);
        }
        
        setSuccess(true);
        setVerifying(false);
        
        // Redirect to home after 2.5 seconds
        setTimeout(() => {
          router.replace('/(tabs)/(home)/');
        }, 2500);
      } else {
        console.log('MagicLinkScreen: No session found, redirecting to auth...');
        setError('No active session found. Please try signing in again.');
        setVerifying(false);
        setTimeout(() => {
          router.replace('/auth');
        }, 3000);
      }
    } catch (error) {
      console.log('MagicLinkScreen: Error during authentication:', error);
      setError('Authentication failed. Please try again.');
      setVerifying(false);
      setTimeout(() => {
        router.replace('/auth');
      }, 3000);
    }
  };

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'session_failed':
        return 'Failed to establish session. Please try again.';
      case 'no_session':
        return 'No session found. Please click the link in your email again.';
      case 'session_check_failed':
        return 'Failed to verify session. Please try again.';
      case 'exception':
        return 'An unexpected error occurred. Please try again.';
      default:
        return 'Authentication failed. Please try again.';
    }
  };

  if (verifying) {
    return (
      <View style={commonStyles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.message}>Signing you in...</Text>
          <Text style={[styles.message, { fontSize: 14, marginTop: 8 }]}>
            Please wait while we verify your magic link
          </Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={commonStyles.container}>
        <View style={styles.content}>
          <View style={styles.errorIconContainer}>
            <IconSymbol 
              ios_icon_name="xmark.circle.fill" 
              android_material_icon_name="cancel" 
              size={64} 
              color={colors.accent} 
            />
          </View>

          <View style={styles.errorBannerContainer}>
            <Text style={styles.errorBannerTitle}>Authentication Failed</Text>
            <Text style={styles.errorBannerSubtitle}>{error}</Text>
          </View>

          <Text style={[styles.message, { marginTop: 24 }]}>
            Redirecting to sign in...
          </Text>
        </View>

        <BrandingFooter />
      </View>
    );
  }

  if (success) {
    return (
      <View style={commonStyles.container}>
        <View style={styles.content}>
          <Image 
            source={require('@/assets/images/d00ee021-be7a-42f9-a115-ea45cb937f7f.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.successIconContainer}>
            <IconSymbol 
              ios_icon_name="checkmark.circle.fill" 
              android_material_icon_name="check_circle" 
              size={64} 
              color={colors.primary} 
            />
          </View>

          <View style={styles.bannerContainer}>
            <Text style={styles.bannerTitle}>You&apos;re signed in. Welcome back!</Text>
            {(firstName || pickleballerNickname) && (
              <Text style={styles.bannerSubtitle}>
                Welcome back, {pickleballerNickname || firstName}!
              </Text>
            )}
          </View>

          <Text style={[styles.message, { marginTop: 24 }]}>
            Redirecting you to the app...
          </Text>
        </View>

        <BrandingFooter />
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <View style={styles.content}>
        <Text style={styles.message}>Redirecting...</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 24,
  },
  successIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  errorIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: `${colors.accent}20`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  bannerContainer: {
    backgroundColor: colors.highlight,
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  errorBannerContainer: {
    backgroundColor: `${colors.accent}20`,
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 30,
  },
  errorBannerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accent,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 30,
  },
  bannerSubtitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 26,
  },
  errorBannerSubtitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 16,
  },
});
