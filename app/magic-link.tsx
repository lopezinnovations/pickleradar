
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/app/integrations/supabase/client';
import { BrandingFooter } from '@/components/BrandingFooter';

export default function MagicLinkScreen() {
  const router = useRouter();
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    handleMagicLink();
  }, []);

  const handleMagicLink = async () => {
    console.log('MagicLinkScreen: Handling magic link authentication...');
    
    try {
      // Wait a moment for the session to be established
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Check if user is now authenticated
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.log('MagicLinkScreen: Error getting session:', error);
        throw error;
      }

      if (session?.user) {
        console.log('MagicLinkScreen: User authenticated successfully:', session.user.email);
        
        // Fetch user profile to get first name
        const { data: profile } = await supabase
          .from('users')
          .select('first_name')
          .eq('id', session.user.id)
          .single();
        
        if (profile?.first_name) {
          setFirstName(profile.first_name);
        }
        
        setSuccess(true);
        setVerifying(false);
        
        // Redirect to home after 2.5 seconds
        setTimeout(() => {
          router.replace('/(tabs)/(home)/');
        }, 2500);
      } else {
        console.log('MagicLinkScreen: No session found, redirecting to auth...');
        setVerifying(false);
        setTimeout(() => {
          router.replace('/auth');
        }, 1500);
      }
    } catch (error) {
      console.log('MagicLinkScreen: Error during authentication:', error);
      setVerifying(false);
      setTimeout(() => {
        router.replace('/auth');
      }, 1500);
    }
  };

  if (verifying) {
    return (
      <View style={commonStyles.container}>
        <View style={styles.content}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.message}>Signing you in...</Text>
        </View>
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
            {firstName && (
              <Text style={styles.bannerSubtitle}>
                Welcome back, {firstName}!
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
  bannerContainer: {
    backgroundColor: colors.highlight,
    paddingVertical: 24,
    paddingHorizontal: 32,
    borderRadius: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.primary,
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
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 16,
  },
});
