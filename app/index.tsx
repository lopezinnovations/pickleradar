
import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase, isSupabaseConfigured } from '@/supabase/client';
import { colors } from '@/styles/commonStyles';

export default function LandingScreen() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    
    try {
      if (!isSupabaseConfigured()) {
        console.log('LandingScreen: Supabase not configured, redirecting to welcome');
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.log('LandingScreen: Error getting session:', sessionError);
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }
      
      if (session?.user) {
        console.log('LandingScreen: User session found:', session.user.email);
        setIsAuthenticated(true);
      } else {
        console.log('LandingScreen: No active session');
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.log('LandingScreen: Error checking auth:', err);
      setError('Failed to initialize app. Please restart.');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

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
  errorText: {
    fontSize: 16,
    color: colors.error,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
