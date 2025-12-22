
import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase, isSupabaseConfigured } from '@/app/integrations/supabase/client';
import { colors } from '@/styles/commonStyles';

export default function LandingScreen() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const hasCheckedAuth = useRef(false);

  useEffect(() => {
    // Only check auth once on mount
    if (hasCheckedAuth.current) {
      return;
    }
    hasCheckedAuth.current = true;
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    console.log('LandingScreen: Checking authentication status...');
    
    if (!isSupabaseConfigured()) {
      console.log('LandingScreen: Supabase not configured, redirecting to welcome');
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.log('LandingScreen: Error getting session:', error);
        setIsAuthenticated(false);
      } else if (session?.user) {
        console.log('LandingScreen: User is logged in:', session.user.email);
        setIsAuthenticated(true);
      } else {
        console.log('LandingScreen: No active session');
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.log('LandingScreen: Error checking auth:', error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Redirect based on authentication status
  if (isAuthenticated) {
    return <Redirect href="/(tabs)/(home)/" />;
  } else {
    return <Redirect href="/welcome" />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
