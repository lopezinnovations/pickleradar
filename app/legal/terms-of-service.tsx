
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
        <Text style={styles.lastUpdated}>Last Updated: February 2026</Text>
        <Text style={styles.version}>Version: v1.1</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing or using PickleRadar (&quot;the App&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree, do not use the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Eligibility</Text>
          <Text style={styles.paragraph}>
            You must be at least 18 years old to create an account and use PickleRadar. By creating an account, you represent and warrant that you are 18 years of age or older.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description of Service</Text>
          <Text style={styles.paragraph}>
            PickleRadar helps players locate courts, view activity levels, check in, connect with other players, and share skill levels and ratings. We may introduce additional features in the future.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Accounts</Text>
          <Text style={styles.paragraph}>
            Provide accurate information, maintain account security, and you are responsible for activity under your account. Optional demographic info (age range and gender) may be provided but is not required.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Conduct</Text>
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
          <Text style={styles.sectionTitle}>Check-Ins and Court Information</Text>
          <Text style={styles.paragraph}>
            Provided for informational purposes only; no guarantees of accuracy or safety.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User Content</Text>
          <Text style={styles.paragraph}>
            By submitting content, you grant PickleRadar a non-exclusive, worldwide, royalty-free license to use and display such content within the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy and Data</Text>
          <Text style={styles.paragraph}>
            Use governed by our Privacy Policy. PickleRadar does not sell personal information. We may share aggregated, anonymized statistical insights.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Disclaimer of Warranties</Text>
          <Text style={styles.paragraph}>
            THE APP IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE SHALL NOT BE LIABLE FOR INDIRECT OR CONSEQUENTIAL DAMAGES.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Termination</Text>
          <Text style={styles.paragraph}>
            We may suspend or terminate accounts for violations.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Changes</Text>
          <Text style={styles.paragraph}>
            We may update these Terms. Continued use constitutes acceptance.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Governing Law</Text>
          <Text style={styles.paragraph}>
            Governed by applicable laws.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact</Text>
          <Text style={styles.paragraph}>
            Contact support through official channels listed in the App.
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
