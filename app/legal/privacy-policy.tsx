
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function PrivacyPolicyScreen() {
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
            android_material_icon_name="chevron-left" 
            size={24} 
            color={colors.primary} 
          />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={[commonStyles.title, { color: colors.primary }]}>Privacy Policy</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.lastUpdated}>Last Updated: January 2025</Text>
        <Text style={styles.version}>Version: v1.0</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Introduction</Text>
          <Text style={styles.paragraph}>
            Welcome to PickleRadar (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Information We Collect</Text>
          <Text style={styles.paragraph}>
            We collect information that you provide directly to us, including:
          </Text>
          <Text style={styles.bulletPoint}>- Account information (email address, password)</Text>
          <Text style={styles.bulletPoint}>- Profile information (skill level, DUPR rating, profile picture)</Text>
          <Text style={styles.bulletPoint}>- Location data (when you grant permission)</Text>
          <Text style={styles.bulletPoint}>- Check-in data (court visits, timestamps, duration)</Text>
          <Text style={styles.bulletPoint}>- Friend connections and social interactions</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Camera Access</Text>
          <Text style={styles.paragraph}>
            PickleRadar may request access to your device camera only when you choose to take or upload a profile photo or court image. Camera access is always user-initiated and is never used in the background. Images are stored only when you choose to upload them.
          </Text>
          <Text style={styles.paragraph}>
            You can control camera permissions at any time through your device settings. Denying camera access will not affect your ability to use other features of the app.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Location Data</Text>
          <Text style={styles.paragraph}>
            Location permission is optional. Location is used only to show nearby courts, calculate distance in miles, and filter courts based on the user&apos;s selected radius. Location is accessed only when the user grants permission and uses location features.
          </Text>
          <Text style={styles.paragraph}>
            We do not track your location continuously. Location data is only accessed when you use the app and have granted permission. You can control location permissions at any time through your device settings.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. How We Use Your Information</Text>
          <Text style={styles.paragraph}>
            We use the information we collect to:
          </Text>
          <Text style={styles.bulletPoint}>- Provide, maintain, and improve our services</Text>
          <Text style={styles.bulletPoint}>- Show you nearby pickleball courts</Text>
          <Text style={styles.bulletPoint}>- Display court activity and player information</Text>
          <Text style={styles.bulletPoint}>- Connect you with friends who are also using the app</Text>
          <Text style={styles.bulletPoint}>- Send you notifications about friend activity (if enabled)</Text>
          <Text style={styles.bulletPoint}>- Analyze usage patterns to improve user experience</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Friend Visibility and Privacy</Text>
          <Text style={styles.paragraph}>
            Your visibility to friends is opt-in only. You control:
          </Text>
          <Text style={styles.bulletPoint}>- Whether friends can see when you&apos;re checked in</Text>
          <Text style={styles.bulletPoint}>- Whether you receive notifications about friend activity</Text>
          <Text style={styles.bulletPoint}>- Who can send you friend requests</Text>
          <Text style={styles.paragraph}>
            You can change these settings at any time in your profile.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Data Sharing and Disclosure</Text>
          <Text style={styles.paragraph}>
            We do not sell your personal information. We may share aggregated, anonymized data about court activity levels. We may disclose your information if required by law or to protect our rights.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. Data Security</Text>
          <Text style={styles.paragraph}>
            We implement appropriate technical and organizational measures to protect your personal information. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Data Retention</Text>
          <Text style={styles.paragraph}>
            We retain your information for as long as your account is active or as needed to provide services. Check-in data expires automatically after 2-3 hours. You can request deletion of your account and data at any time.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Your Rights</Text>
          <Text style={styles.paragraph}>
            You have the right to:
          </Text>
          <Text style={styles.bulletPoint}>- Access your personal information</Text>
          <Text style={styles.bulletPoint}>- Correct inaccurate information</Text>
          <Text style={styles.bulletPoint}>- Request deletion of your account and data</Text>
          <Text style={styles.bulletPoint}>- Opt out of notifications and location services</Text>
          <Text style={styles.bulletPoint}>- Control your privacy settings</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. Children&apos;s Privacy</Text>
          <Text style={styles.paragraph}>
            Our service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Changes to This Privacy Policy</Text>
          <Text style={styles.paragraph}>
            We may update this Privacy Policy from time to time. We will notify you of any changes by updating the &quot;Last Updated&quot; date and version number. Continued use of the app after changes constitutes acceptance of the updated policy.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>13. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have questions about this Privacy Policy, please contact us through the app or at our support channels.
          </Text>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingTop: 48,
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
