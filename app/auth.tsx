
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { useAuth } from '@/hooks/useAuth';
import { IconSymbol } from '@/components/IconSymbol';

export default function AuthScreen() {
  const router = useRouter();
  const { signIn, signUp, isConfigured } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (isSignUp && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }

    if (!isConfigured) {
      Alert.alert(
        'Supabase Required',
        'Please enable Supabase by pressing the Supabase button in Natively and connecting to a project to use authentication features.'
      );
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const result = await signUp(email, password);
        
        if (result.success) {
          if (result.requiresEmailVerification) {
            Alert.alert(
              'Verify Your Email',
              'We\'ve sent a verification link to your email address. Please check your inbox and click the link to verify your account before signing in.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    setIsSignUp(false);
                    setPassword('');
                    setConfirmPassword('');
                  }
                }
              ]
            );
          } else {
            Alert.alert('Success', result.message || 'Account created successfully!');
            router.replace('/(tabs)/(home)/');
          }
        } else {
          Alert.alert('Sign Up Failed', result.message || 'Failed to create account. Please try again.');
        }
      } else {
        const result = await signIn(email, password);
        
        if (result.success) {
          Alert.alert('Success', result.message || 'Successfully signed in!');
          router.replace('/(tabs)/(home)/');
        } else {
          if (result.requiresEmailVerification) {
            Alert.alert(
              'Email Not Verified',
              result.message || 'Please verify your email address before signing in. Check your inbox for the verification link.',
              [
                { text: 'OK' }
              ]
            );
          } else {
            Alert.alert('Sign In Failed', result.message || 'Failed to sign in. Please check your credentials and try again.');
          }
        }
      }
    } catch (error: any) {
      console.log('Auth error:', error);
      Alert.alert('Error', error?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          onPress={() => router.back()}
        >
          <IconSymbol 
            ios_icon_name="chevron.left" 
            android_material_icon_name="chevron_left" 
            size={24} 
            color={colors.primary} 
          />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Image 
            source={require('@/assets/images/d00ee021-be7a-42f9-a115-ea45cb937f7f.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[commonStyles.title, { color: colors.primary }]}>
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text style={commonStyles.textSecondary}>
            {isSignUp ? 'Sign up to start finding courts' : 'Sign in to continue'}
          </Text>
        </View>

        <View style={styles.form}>
          <TextInput
            style={commonStyles.input}
            placeholder="Email"
            placeholderTextColor={colors.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <TextInput
            style={commonStyles.input}
            placeholder="Password"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            editable={!loading}
          />

          {isSignUp && (
            <TextInput
              style={commonStyles.input}
              placeholder="Confirm Password"
              placeholderTextColor={colors.textSecondary}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />
          )}

          <TouchableOpacity
            style={[buttonStyles.primary, { marginTop: 8 }, loading && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={buttonStyles.text}>
                {isSignUp ? 'Sign Up' : 'Sign In'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.switchButton}
            onPress={() => {
              setIsSignUp(!isSignUp);
              setPassword('');
              setConfirmPassword('');
            }}
            disabled={loading}
          >
            <Text style={commonStyles.textSecondary}>
              {isSignUp ? 'Already have an account? ' : 'Don\'t have an account? '}
              <Text style={styles.switchButtonText}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </Text>
            </Text>
          </TouchableOpacity>
        </View>

        {!isConfigured && (
          <View style={[commonStyles.card, { backgroundColor: colors.accent, marginTop: 20 }]}>
            <View style={styles.warningHeader}>
              <IconSymbol 
                ios_icon_name="exclamationmark.triangle.fill" 
                android_material_icon_name="warning" 
                size={24} 
                color={colors.card} 
              />
              <Text style={[commonStyles.subtitle, { marginLeft: 12, color: colors.card }]}>
                Supabase Required
              </Text>
            </View>
            <Text style={[commonStyles.textSecondary, { marginTop: 12, color: colors.card }]}>
              To use authentication and all features, please enable Supabase by pressing the Supabase button 
              in Natively and connecting to a project.
            </Text>
          </View>
        )}

        {isSignUp && (
          <View style={[commonStyles.card, { marginTop: 20, backgroundColor: colors.highlight }]}>
            <View style={styles.infoHeader}>
              <IconSymbol 
                ios_icon_name="info.circle.fill" 
                android_material_icon_name="info" 
                size={20} 
                color={colors.primary} 
              />
              <Text style={[commonStyles.textSecondary, { marginLeft: 8, fontSize: 14 }]}>
                You&apos;ll need to verify your email address before you can sign in.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
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
  logo: {
    width: 96,
    height: 96,
    marginBottom: 16,
  },
  form: {
    width: '100%',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchButtonText: {
    color: colors.primary,
    fontWeight: '600',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
});
