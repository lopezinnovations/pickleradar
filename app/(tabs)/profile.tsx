// app/(tabs)/profile.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';

import { useAuth } from '@/hooks/useAuth';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';

const AUTH_ROUTE = '/auth';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading, signOut, changePassword } = useAuth();

  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [savingPw, setSavingPw] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = async () => {
    if (signingOut) return;

    setSigningOut(true);
    try {
      await signOut();
    } catch (e: any) {
      // Even if Supabase errors, we already cleared local user — still route out
      console.log('[PROFILE] signOut error:', e?.message);
    } finally {
      router.replace(AUTH_ROUTE as any);
      setSigningOut(false);
    }
  };

  const onChangePassword = async () => {
    if (savingPw) return;

    const p1 = pw1.trim();
    const p2 = pw2.trim();

    if (p1.length < 6) {
      Alert.alert('Password too short', 'Use at least 6 characters.');
      return;
    }
    if (p1 !== p2) {
      Alert.alert('Passwords do not match', 'Make sure both password fields match.');
      return;
    }

    setSavingPw(true);
    try {
      await changePassword(p1);

      // Success = no error, so show success and force a clean re-login
      Alert.alert(
        'Success',
        'Password updated. Please sign in again.',
        [
          {
            text: 'OK',
            onPress: async () => {
              try {
                await signOut();
              } catch {}
              router.replace(AUTH_ROUTE as any);
            },
          },
        ],
        { cancelable: false }
      );

      setPw1('');
      setPw2('');
    } catch (e: any) {
      Alert.alert('Password update failed', e?.message || 'Please try again.');
    } finally {
      setSavingPw(false);
    }
  };

  if (loading) {
    return (
      <View style={[commonStyles.container, commonStyles.centered]}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[commonStyles.container, commonStyles.centered]}>
        <Stack.Screen options={{ title: 'Profile' }} />
        <Text style={commonStyles.textSecondary}>You’re signed out.</Text>
        <TouchableOpacity
          style={[buttonStyles.primary, { marginTop: 16 }]}
          onPress={() => router.replace(AUTH_ROUTE as any)}
        >
          <Text style={buttonStyles.text}>Go to Sign In</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={commonStyles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Profile' }} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.title}>Account</Text>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email ?? 'Unknown'}</Text>

          <TouchableOpacity
            style={[buttonStyles.secondary, styles.signOutBtn]}
            onPress={onSignOut}
            disabled={signingOut}
            activeOpacity={0.8}
          >
            {signingOut ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={buttonStyles.text}>Sign Out</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Change Password</Text>

          <Text style={styles.label}>New password</Text>
          <TextInput
            value={pw1}
            onChangeText={setPw1}
            placeholder="Enter new password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={[styles.label, { marginTop: 12 }]}>Confirm new password</Text>
          <TextInput
            value={pw2}
            onChangeText={setPw2}
            placeholder="Confirm new password"
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />

          <TouchableOpacity
            style={[buttonStyles.primary, styles.pwBtn, savingPw && { opacity: 0.7 }]}
            onPress={onChangePassword}
            disabled={savingPw}
            activeOpacity={0.8}
          >
            {savingPw ? (
              <ActivityIndicator color={colors.card} size="small" />
            ) : (
              <Text style={buttonStyles.text}>Update Password</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.hint}>
            After updating, you’ll be signed out and asked to sign in again.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 60,
    gap: 16,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: colors.text,
    backgroundColor: colors.background,
  },
  signOutBtn: {
    marginTop: 16,
  },
  pwBtn: {
    marginTop: 16,
  },
  hint: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textSecondary,
  },
});
