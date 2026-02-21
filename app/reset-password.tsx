import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

const EXPIRED_MSG = 'Your session expired. Please request a new reset code and try again.';

const needsReauth = (msg: string) => /recent|aal|expired|session|jwt/i.test(msg);

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = (params.email as string) ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isBootstrappingSession, setIsBootstrappingSession] = useState(true);
  const [hasValidSession, setHasValidSession] = useState(false);

  const passwordUpdateSucceededRef = useRef(false);
  const resetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;

    const bootstrapSession = async () => {
      if (!isSupabaseConfigured() || !supabase) {
        if (mounted) {
          setHasValidSession(false);
          setResetError(EXPIRED_MSG);
        }
        setIsBootstrappingSession(false);
        return;
      }

      if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hash) {
        const hash = window.location.hash.replace(/^#/, '');
        const hashParams = new URLSearchParams(hash);
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');
        if (access_token && refresh_token) {
          try {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (!mounted) return;
            if (error) {
              setHasValidSession(false);
              setResetError(EXPIRED_MSG);
              setIsBootstrappingSession(false);
              return;
            }
            if (typeof history !== 'undefined') {
              history.replaceState(null, '', window.location.pathname + window.location.search);
            }
          } catch {
            if (mounted) {
              setHasValidSession(false);
              setResetError(EXPIRED_MSG);
            }
            setIsBootstrappingSession(false);
            return;
          }
        }
      }

      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;
      if (error || !data?.session) {
        setHasValidSession(false);
        setResetError(EXPIRED_MSG);
      } else {
        setHasValidSession(true);
        setResetError(null);
      }
      setIsBootstrappingSession(false);
    };

    bootstrapSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) clearTimeout(resetTimeoutRef.current);
    };
  }, []);

  const validatePassword = (password: string) => password.length >= 8;

  const handleResetPassword = async () => {
    if (isSubmitting || isBootstrappingSession || !hasValidSession) return;

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
    if (!isSupabaseConfigured()) {
      Alert.alert('Unable to update password', 'Sign-in is not configured. Cannot update password.');
      return;
    }

    setIsSubmitting(true);
    setResetError(null);
    passwordUpdateSucceededRef.current = false;

    resetTimeoutRef.current = setTimeout(() => {
      if (!passwordUpdateSucceededRef.current) {
        setResetError('Request is taking longer than expected. Please try again.');
        setIsSubmitting(false);
      }
    }, 15000);

    try {
      if (!supabase) {
        throw new Error('Sign-in is not configured. Cannot update password.');
      }
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      if (sessionErr) throw sessionErr;
      if (!sessionData.session) {
        throw new Error(EXPIRED_MSG);
      }

      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updateErr) {
        if (needsReauth(updateErr.message)) {
          throw new Error('Your reset session expired. Please request a new reset code and try again.');
        }
        throw updateErr;
      }

      await supabase.auth.signOut();

      const emailForSignIn = (email ?? '').trim();
      if (!emailForSignIn) {
        throw new Error('Missing email. Please go back and restart the reset flow.');
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailForSignIn,
        password: newPassword,
      });

      if (signInError) {
        throw new Error(
          signInError.message || 'New password did not work. Please try again or sign in with code.'
        );
      }

      const { data: sessionCheck, error: sessionCheckErr } = await supabase.auth.getSession();
      const hasSession = !!sessionCheck?.session;
      const hasRefreshToken = !!sessionCheck?.session?.refresh_token;
      if (__DEV__) {
        console.log('[AUTH] Password update + verification success; session present:', hasSession, 'refresh_token present:', hasRefreshToken);
      }
      if (sessionCheckErr || !hasSession) {
        throw new Error('Session not persisted. Please try again.');
      }

      console.log('[AUTH] Password update + verification success');
      passwordUpdateSucceededRef.current = true;
      setNewPassword('');
      setConfirmPassword('');
      setResetError(null);

      Alert.alert('Success', 'Password updated.', [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)'),
        },
      ]);
    } catch (e: any) {
      const msg = e?.message ?? 'Please try again.';
      setResetError(msg);
      Alert.alert('Unable to update password', msg);
    } finally {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
      setIsSubmitting(false);
    }
  };

  const handleContinueWithCode = () => {
    router.replace('/(tabs)');
  };

  const handleBackToSignIn = () => {
    router.replace('/auth');
  };

  const resetButtonDisabled =
    isSubmitting ||
    isBootstrappingSession ||
    !hasValidSession ||
    !newPassword ||
    !confirmPassword;

  if (isBootstrappingSession) {
    return (
      <View style={[commonStyles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[commonStyles.textSecondary, { marginTop: 12 }]}>Loading...</Text>
      </View>
    );
  }

  if (!hasValidSession) {
    return (
      <View style={[commonStyles.container, styles.centered]}>
        <IconSymbol
          ios_icon_name="lock.shield.fill"
          android_material_icon_name="lock"
          size={48}
          color={colors.textSecondary}
        />
        <Text style={[commonStyles.title, { marginTop: 16, textAlign: 'center' }]}>Session Expired</Text>
        <Text style={[commonStyles.textSecondary, { marginTop: 8, textAlign: 'center', paddingHorizontal: 24 }]}>
          {resetError ?? EXPIRED_MSG}
        </Text>
        <TouchableOpacity
          style={[buttonStyles.primary, { marginTop: 24 }]}
          onPress={handleBackToSignIn}
        >
          <Text style={buttonStyles.text}>Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={commonStyles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} disabled={isSubmitting}>
          <IconSymbol ios_icon_name="chevron.left" android_material_icon_name="chevron-left" size={24} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <IconSymbol ios_icon_name="lock.shield.fill" android_material_icon_name="lock" size={48} color={colors.primary} />
          </View>
          <Text style={[commonStyles.title, { color: colors.primary }]}>Reset Password</Text>
          <Text style={commonStyles.textSecondary}>Create a new password for your account</Text>
        </View>

        <Text style={styles.label}>New Password</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={commonStyles.input}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textSecondary}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNewPassword}
            autoCapitalize="none"
            editable={!isSubmitting}
          />
          <TouchableOpacity
            style={styles.showPasswordButton}
            onPress={() => setShowNewPassword(!showNewPassword)}
            disabled={isSubmitting}
          >
            <Text style={styles.showPasswordText}>{showNewPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>Confirm New Password</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={commonStyles.input}
            placeholder="Re-enter your password"
            placeholderTextColor={colors.textSecondary}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            editable={!isSubmitting}
          />
          <TouchableOpacity
            style={styles.showPasswordButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            disabled={isSubmitting}
          >
            <Text style={styles.showPasswordText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
        </View>

        {resetError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{resetError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[buttonStyles.primary, styles.resetButton, resetButtonDisabled && styles.buttonDisabled]}
          onPress={handleResetPassword}
          disabled={resetButtonDisabled}
        >
          {isSubmitting ? (
            <ActivityIndicator color={colors.card} />
          ) : (
            <Text style={buttonStyles.text}>Reset Password</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.continueLink} onPress={handleContinueWithCode} disabled={isSubmitting}>
          <Text style={commonStyles.textSecondary}>Continue with Code (skip reset)</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  backButton: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  backText: { marginLeft: 4, fontSize: 16, color: colors.primary, fontWeight: '600' },
  header: { alignItems: 'center', marginBottom: 24 },
  iconContainer: { marginBottom: 12 },
  label: { ...commonStyles.text, marginTop: 12, marginBottom: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  showPasswordButton: { marginLeft: 8, padding: 8 },
  showPasswordText: { fontSize: 14, color: colors.primary, fontWeight: '600' },
  errorContainer: { marginTop: 12, padding: 12, backgroundColor: colors.highlight, borderRadius: 8 },
  errorText: { color: colors.error, fontSize: 14 },
  resetButton: { marginTop: 24, paddingVertical: 14 },
  buttonDisabled: { opacity: 0.6 },
  continueLink: { marginTop: 16, alignItems: 'center' },
});
