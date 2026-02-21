
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
        <Text style={styles.lastUpdated}>Last Updated: February 2026</Text>
        <Text style={styles.version}>Version: v1.1</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Information We Collect</Text>
          <Text style={styles.paragraph}>- Name and email</Text>
          <Text style={styles.paragraph}>- Profile info (skill level, ratings)</Text>
          <Text style={styles.paragraph}>- Optional demographic info (age range, gender)</Text>
          <Text style={styles.paragraph}>- Location data (if enabled by user)</Text>
          <Text style={styles.paragraph}>- Check-in activity</Text>
          <Text style={styles.paragraph}>- Basic device/usage data needed to operate the app</Text>
          <Text style={styles.paragraph}>Demographic info is optional.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How We Use Information</Text>
          <Text style={styles.paragraph}>
            To operate and improve the app, enable player matching, provide court activity insights, and improve reliability.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Controls</Text>
          <Text style={styles.paragraph}>
            Location sharing is optional and can be disabled in settings.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aggregated Insights</Text>
          <Text style={styles.paragraph}>
            We may generate aggregated, anonymized statistical insights (court usage trends, skill distributions, age range trends, engagement metrics). These do not include personal identifiers and cannot reasonably identify individuals. PickleRadar does not sell personal information.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Retention</Text>
          <Text style={styles.paragraph}>
            Users may delete accounts at any time.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Security</Text>
          <Text style={styles.paragraph}>
            Reasonable safeguards are used.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Rights</Text>
          <Text style={styles.paragraph}>
            Users may request access or deletion of their data.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Changes</Text>
          <Text style={styles.paragraph}>
            We may update this policy periodically.
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
