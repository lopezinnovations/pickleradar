
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, Linking, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase, isSupabaseConfigured } from "@/app/integrations/supabase/client";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const passwordUpdateSucceededRef = useRef(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  // Deep link handler: support ?code=... OR #access_token=...&refresh_token=...
  useEffect(() => {
    if (Platform.OS === 'web') return;
    console.log('RESET: screen opened');

    const parseAndInitFromUrl = async (url: string) => {
      if (processedUrlRef.current === url) return;
      processedUrlRef.current = url;
      console.log('RESET: deep link received', url);

      let code: string | null = null;
      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      try {
        const parsed = new URL(url);
        code = parsed.searchParams.get('code');
        const hash = parsed.hash.slice(1);
        const hashParams = new URLSearchParams(hash);
        accessToken = hashParams.get('access_token');
        refreshToken = hashParams.get('refresh_token');
      } catch (e) {
        console.log('RESET: parsed (URL parse error, skipping)');
        return;
      }

      if (code) {
        console.log('RESET: parsed (code)');
      } else if (accessToken && refreshToken) {
        console.log('RESET: parsed (access_token/refresh_token)');
      } else {
        console.log('RESET: parsed (no code or tokens, skipping)');
        return;
      }

      console.log('RESET: session init start');
      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (error) throw error;
        }
        console.log('RESET: session init success');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log('RESET: session init fail', msg);
        setResetError('Reset link expired or invalid. Request a new one.');
      }
    };

    const handleUrl = (url: string | null) => {
      if (!url) return;
      const lower = url.toLowerCase();
      if (lower.includes('reset-password') || lower.includes('reset_password')) {
        parseAndInitFromUrl(url);
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  const validatePassword = (password: string) => {
    return password.length >= 8;
  };

  const handleResetPassword = async () => {
    console.log('User tapped Reset Password button');

    // Prevent double submits
    if (isSubmitting) {
      console.log('Already submitting, ignoring duplicate request');
      return;
    }

    if (!newPassword.trim()) {
      Alert.alert('Error', 'Please enter a new password');
      return;
    }

    if (!validatePassword(newPassword)) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    if (!confirmPassword.trim()) {
      Alert.alert('Error', 'Please confirm your password');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    setResetError(null);
    passwordUpdateSucceededRef.current = false;

    resetTimeoutRef.current = setTimeout(() => {
      if (!passwordUpdateSucceededRef.current) {
        console.log('RESET: timeout exceeded');
        setResetError('Request is taking longer than expected. Please try again.');
        setIsSubmitting(false);
      }
    }, 15000);

    try {
      if (!isSupabaseConfigured()) {
        setResetError('Sign-in is not configured. Cannot update password.');
        return;
      }

      console.log('RESET: session init start');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.log('RESET: session init fail', sessionError.message);
        setResetError('Reset link expired or invalid. Request a new one.');
        return;
      }
      if (!session?.access_token) {
        console.log('RESET: session init fail (no access_token)');
        setResetError('Reset link expired or invalid. Request a new one.');
        return;
      }
      console.log('RESET: session init success');

      console.log('RESET: updateUser(password) start');
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.log('RESET: updateUser(password) fail', updateError.message, updateError.status);
        passwordUpdateSucceededRef.current = false;
        const raw = updateError.message || 'Failed to update password.';
        const errorMessage = raw.toLowerCase();
        if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
          setResetError('Please wait a moment and try again.');
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          setResetError('Network error. Please check your connection and try again.');
        } else {
          setResetError('Unable to finish resetting password. Please try again.');
        }
        return;
      }

      passwordUpdateSucceededRef.current = true;
      console.log('RESET: updateUser(password) success');

      setNewPassword('');
      setConfirmPassword('');
      setResetError(null);

      Alert.alert(
        'Password updated',
        'Your password has been changed. You can now sign in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/(tabs)/(home)/');
            },
          },
        ]
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log('RESET: updateUser(password) fail (exception)', msg);
      setResetError('An unexpected error occurred. Please try again.');
      passwordUpdateSucceededRef.current = false;
    } finally {
      // Always clear timeout and loading state
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      setIsSubmitting(false);
    }
  };

  const handleContinueWithCode = () => {
    console.log('User chose to continue with code (skip reset)');
    
    // Navigate to app immediately (no modal)
    router.replace('/(tabs)/(home)/');
  };

  const handleBack = () => {
    router.back();
  };

  // Compute button disabled state
  const resetButtonDisabled = isSubmitting || !newPassword || !confirmPassword;

  return (
    <View style={commonStyles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
          disabled={isSubmitting}
        >
          <IconSymbol 
            ios_icon_name="chevron.left" 
            android_material_icon_name="chevron-left" 
            size={24} 
            color={colors.primary} 
          />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <IconSymbol 
              ios_icon_name="lock.shield.fill" 
              android_material_icon_name="lock" 
              size={48} 
              color={colors.primary} 
            />
          </View>
          <Text style={[commonStyles.title, { color: colors.primary }]}>
            Reset Password
          </Text>
          <Text style={commonStyles.textSecondary}>
            Create a new password for your account
          </Text>
          {email && (
            <Text style={styles.emailText}>
              {email}
            </Text>
          )}
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={commonStyles.input}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textSecondary}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
          />
          <TouchableOpacity
            style={styles.showPasswordButton}
            onPress={() => setShowNewPassword(!showNewPassword)}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text style={styles.showPasswordText}>
              {showNewPassword ? 'Hide Password' : 'Show Password'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.label}>Confirm New Password</Text>
          <TextInput
            style={commonStyles.input}
            placeholder="Re-enter your password"
            placeholderTextColor={colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isSubmitting}
          />
          <TouchableOpacity
            style={styles.showPasswordButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text style={styles.showPasswordText}>
              {showConfirmPassword ? 'Hide Password' : 'Show Password'}
            </Text>
          </TouchableOpacity>

          <View style={styles.requirementsContainer}>
            <Text style={styles.requirementsTitle}>Password Requirements:</Text>
            <View style={styles.requirementRow}>
              <IconSymbol 
                ios_icon_name={newPassword.length >= 8 ? 'checkmark.circle.fill' : 'circle'} 
                android_material_icon_name={newPassword.length >= 8 ? 'check-circle' : 'radio-button-unchecked'} 
                size={20} 
                color={newPassword.length >= 8 ? colors.primary : colors.textSecondary} 
              />
              <Text style={[styles.requirementText, newPassword.length >= 8 && styles.requirementMet]}>
                At least 8 characters
              </Text>
            </View>
            <View style={styles.requirementRow}>
              <IconSymbol 
                ios_icon_name={newPassword === confirmPassword && newPassword.length > 0 ? 'checkmark.circle.fill' : 'circle'} 
                android_material_icon_name={newPassword === confirmPassword && newPassword.length > 0 ? 'check-circle' : 'radio-button-unchecked'} 
                size={20} 
                color={newPassword === confirmPassword && newPassword.length > 0 ? colors.primary : colors.textSecondary} 
              />
              <Text style={[styles.requirementText, newPassword === confirmPassword && newPassword.length > 0 && styles.requirementMet]}>
                Passwords match
              </Text>
            </View>
          </View>

          {resetError && (
            <View style={styles.errorContainer}>
              <IconSymbol 
                ios_icon_name="exclamationmark.triangle.fill" 
                android_material_icon_name="warning" 
                size={20} 
                color={colors.accent} 
              />
              <Text style={styles.errorMessage}>{resetError}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              buttonStyles.primary, 
              { marginTop: 24 }, 
              resetButtonDisabled && { opacity: 0.6 }
            ]}
            onPress={handleResetPassword}
            disabled={resetButtonDisabled}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={colors.card} size="small" />
                <Text style={[buttonStyles.text, { marginLeft: 8 }]}>
                  Resetting...
                </Text>
              </View>
            ) : (
              <Text style={buttonStyles.text}>
                Reset Password
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleContinueWithCode}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>
              Continue with Code (skip reset)
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emailText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
    fontWeight: '500',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginTop: 12,
  },
  showPasswordButton: {
    marginTop: 8,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  showPasswordText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  requirementsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  requirementMet: {
    color: colors.primary,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.accent,
    marginLeft: 8,
    flex: 1,
    fontWeight: '500',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButton: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
