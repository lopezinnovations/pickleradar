
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function AuthMigrationNoticeScreen() {
  const router = useRouter();

  return (
    <View style={commonStyles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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
          <View style={styles.iconContainer}>
            <IconSymbol 
              ios_icon_name="info.circle.fill" 
              android_material_icon_name="info" 
              size={64} 
              color={colors.primary} 
            />
          </View>
          <Text style={[commonStyles.title, { color: colors.primary, textAlign: 'center' }]}>
            Authentication Update
          </Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>What Changed?</Text>
          <Text style={styles.bodyText}>
            PickleRadar now uses phone number authentication for a better and more secure experience.
          </Text>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>For Existing Users</Text>
          <Text style={styles.bodyText}>
            If you previously signed up with an email address, you&apos;ll need to create a new account using your phone number.
          </Text>

          <View style={styles.stepsContainer}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>Enter your phone number</Text>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>Receive a verification code via SMS</Text>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>Enter the code to verify your account</Text>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Why Phone Numbers?</Text>
          <View style={styles.benefitsList}>
            <View style={styles.benefit}>
              <IconSymbol 
                ios_icon_name="checkmark.circle.fill" 
                android_material_icon_name="check_circle" 
                size={20} 
                color={colors.primary} 
              />
              <Text style={styles.benefitText}>Faster sign-in process</Text>
            </View>
            <View style={styles.benefit}>
              <IconSymbol 
                ios_icon_name="checkmark.circle.fill" 
                android_material_icon_name="check_circle" 
                size={20} 
                color={colors.primary} 
              />
              <Text style={styles.benefitText}>More secure verification</Text>
            </View>
            <View style={styles.benefit}>
              <IconSymbol 
                ios_icon_name="checkmark.circle.fill" 
                android_material_icon_name="check_circle" 
                size={20} 
                color={colors.primary} 
              />
              <Text style={styles.benefitText}>No passwords to remember</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[buttonStyles.primary, { marginTop: 32 }]}
            onPress={() => router.push('/auth')}
            activeOpacity={0.8}
          >
            <Text style={buttonStyles.text}>Continue to Sign In</Text>
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
    marginBottom: 16,
  },
  content: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
  },
  stepsContainer: {
    marginTop: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  benefitsList: {
    marginTop: 12,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 12,
  },
});
