
import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, Modal } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/app/integrations/supabase/client';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const email = params.email as string;

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSkipResetModal, setShowSkipResetModal] = useState(false);

  // Refs to track loading state for timeout checks
  const isLoadingRef = useRef(false);
  const resetTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Update ref when state changes
  useEffect(() => {
    isLoadingRef.current = isLoading;
  }, [isLoading]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  const validatePassword = (password: string) => {
    return password.length >= 8;
  };

  const handleResetPassword = async () => {
    console.log('User tapped Reset Password button');

    // Prevent double submits
    if (isSubmitting || isLoading) {
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

    setIsLoading(true);
    setIsSubmitting(true);
    setResetError(null);

    // Set timeout for password reset (15 seconds)
    resetTimeoutRef.current = setTimeout(() => {
      if (isLoadingRef.current) {
        console.log('Password reset timeout exceeded');
        setResetError('This is taking longer than expected. Please try again.');
        setIsLoading(false);
        setIsSubmitting(false);
      }
    }, 15000);

    try {
      console.log('Updating password in Supabase');
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword
      });

      // Clear timeout immediately after response
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }

      if (error) {
        console.log('Password update error:', error);
        
        // Check for specific error types
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('rate limit') || errorMessage.includes('too many')) {
          setResetError('Please wait a moment and try again.');
        } else if (errorMessage.includes('network') || errorMessage.includes('connection')) {
          setResetError('Network error. Please check your connection and try again.');
        } else {
          setResetError(error.message || 'Failed to reset password. Please try again.');
        }
        return;
      }

      console.log('Password updated successfully');

      // Clear form
      setNewPassword('');
      setConfirmPassword('');
      setResetError(null);

      // Try to refresh session, but don't treat failure as reset failure
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
        if (sessionError) {
          console.log('Session refresh failed (non-critical):', sessionError);
        }
      } catch (sessionErr) {
        console.log('Session refresh error (non-critical):', sessionErr);
      }

      // Show success message and navigate
      Alert.alert(
        'Password Updated Successfully',
        'Your password has been changed. You can now sign in with your new password.',
        [
          {
            text: 'OK',
            onPress: () => {
              // Navigate to app if session exists, otherwise to sign in
              supabase.auth.getSession().then(({ data: { session } }) => {
                if (session) {
                  console.log('Session exists, routing to app');
                  router.replace('/(tabs)/(home)/');
                } else {
                  console.log('No session, routing to sign in');
                  router.replace({
                    pathname: '/auth',
                    params: { email: email || '', message: 'Password updated successfully. Please sign in.' }
                  });
                }
              }).catch(() => {
                // Fallback to sign in on error
                console.log('Error checking session, routing to sign in');
                router.replace({
                  pathname: '/auth',
                  params: { email: email || '', message: 'Password updated successfully. Please sign in.' }
                });
              });
            },
          },
        ]
      );
    } catch (error: any) {
      console.log('Unexpected error during password reset:', error);
      setResetError(error.message || 'An unexpected error occurred. Please try again.');
    } finally {
      // Always clear timeout and loading state
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
      }
      setIsLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleContinueWithCode = async () => {
    console.log('User chose to continue with code (skip reset)');
    setShowSkipResetModal(false);
    
    // Navigate to app
    router.replace('/(tabs)/(home)/');
  };

  const handleBack = () => {
    router.back();
  };

  // Compute button disabled state
  const resetButtonDisabled = isLoading || isSubmitting || !newPassword || !confirmPassword;

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
          disabled={isLoading}
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
            editable={!isLoading}
          />
          <TouchableOpacity
            style={styles.showPasswordButton}
            onPress={() => setShowNewPassword(!showNewPassword)}
            disabled={isLoading}
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
            editable={!isLoading}
          />
          <TouchableOpacity
            style={styles.showPasswordButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            disabled={isLoading}
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
            {isLoading ? (
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
            onPress={() => setShowSkipResetModal(true)}
            disabled={isLoading}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>
              Continue with Code (skip reset)
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Skip Reset Modal */}
      <Modal
        visible={showSkipResetModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSkipResetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sign in without changing your password?</Text>
            <Text style={styles.modalBody}>
              You&apos;ll be signed in using a one-time code. You can reset your password anytime by using &apos;Forgot password&apos; from the sign-in screen.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonSecondary]}
                onPress={() => setShowSkipResetModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleContinueWithCode}
                activeOpacity={0.7}
              >
                <Text style={styles.modalButtonTextPrimary}>Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 48,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonPrimary: {
    backgroundColor: colors.primary,
  },
  modalButtonSecondary: {
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.card,
  },
  modalButtonTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});
