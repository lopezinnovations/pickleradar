
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function TermsOfServiceScreen() {
  const router = useRouter();

  return (
    <View style={commonStyles.container}>
      <View style={styles.header}>
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
        <Text style={[commonStyles.title, { color: colors.primary }]}>Terms of Service</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.lastUpdated}>Last Updated: January 2025</Text>
        <Text style={styles.version}>Version: v1.0</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing or using PickleRadar (&quot;the App&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, do not use the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Description of Service</Text>
          <Text style={styles.paragraph}>
            PickleRadar is a mobile application that helps pickleball players:
          </Text>
          <Text style={styles.bulletPoint}>- Find pickleball courts near them</Text>
          <Text style={styles.bulletPoint}>- See real-time court activity levels</Text>
          <Text style={styles.bulletPoint}>- Check in at courts to show their presence</Text>
          <Text style={styles.bulletPoint}>- Connect with friends and see when they&apos;re playing</Text>
          <Text style={styles.bulletPoint}>- Share skill level and DUPR ratings</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. User Accounts</Text>
          <Text style={styles.paragraph}>
            To use certain features, you must create an account. You agree to:
          </Text>
          <Text style={styles.bulletPoint}>- Provide accurate and complete information</Text>
          <Text style={styles.bulletPoint}>- Maintain the security of your password</Text>
          <Text style={styles.bulletPoint}>- Notify us immediately of any unauthorized access</Text>
          <Text style={styles.bulletPoint}>- Be responsible for all activities under your account</Text>
          <Text style={styles.paragraph}>
            You must be at least 13 years old to create an account.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. User Conduct</Text>
          <Text style={styles.paragraph}>
            You agree not to:
          </Text>
          <Text style={styles.bulletPoint}>- Provide false or misleading information</Text>
          <Text style={styles.bulletPoint}>- Impersonate another person or entity</Text>
          <Text style={styles.bulletPoint}>- Harass, abuse, or harm other users</Text>
          <Text style={styles.bulletPoint}>- Use the App for any illegal purpose</Text>
          <Text style={styles.bulletPoint}>- Attempt to gain unauthorized access to the App</Text>
          <Text style={styles.bulletPoint}>- Interfere with the proper functioning of the App</Text>
          <Text style={styles.bulletPoint}>- Submit spam or malicious content</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Check-Ins and Court Information</Text>
          <Text style={styles.paragraph}>
            Check-ins are temporary and expire automatically after 2-3 hours. Court information is provided for informational purposes only. We do not guarantee:
          </Text>
          <Text style={styles.bulletPoint}>- Accuracy of court locations or details</Text>
          <Text style={styles.bulletPoint}>- Availability of courts</Text>
          <Text style={styles.bulletPoint}>- Court conditions or safety</Text>
          <Text style={styles.paragraph}>
            Always verify court information independently before visiting.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. User-Submitted Content</Text>
          <Text style={styles.paragraph}>
            You may submit court information, photos, and other content. By submitting content, you grant us a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content within the App.
          </Text>
          <Text style={styles.paragraph}>
            You represent that you own or have the right to submit any content you provide.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Privacy and Data</Text>
          <Text style={styles.paragraph}>
            Your use of the App is also governed by our Privacy Policy. By using the App, you consent to our collection and use of your information as described in the Privacy Policy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Intellectual Property</Text>
          <Text style={styles.paragraph}>
            The App and its content, features, and functionality are owned by PickleRadar and are protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works without our permission.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Disclaimer of Warranties</Text>
          <Text style={styles.paragraph}>
            THE APP IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE APP.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Indemnification</Text>
          <Text style={styles.paragraph}>
            You agree to indemnify and hold harmless PickleRadar and its affiliates from any claims, damages, or expenses arising from your use of the App or violation of these Terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Termination</Text>
          <Text style={styles.paragraph}>
            We may terminate or suspend your account at any time for any reason, including violation of these Terms. You may delete your account at any time through the App settings.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>13. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We reserve the right to modify these Terms at any time. We will notify you of material changes by updating the &quot;Last Updated&quot; date and version number. Continued use after changes constitutes acceptance of the modified Terms.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>14. Governing Law</Text>
          <Text style={styles.paragraph}>
            These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>15. Contact Information</Text>
          <Text style={styles.paragraph}>
            If you have questions about these Terms, please contact us through the App or at our support channels.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  lastUpdated: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  version: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    marginLeft: 16,
    marginBottom: 8,
  },
  bottomPadding: {
    height: 40,
  },
});
