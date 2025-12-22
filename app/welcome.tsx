
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={commonStyles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Image 
            source={require('@/assets/images/d00ee021-be7a-42f9-a115-ea45cb937f7f.jpeg')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.tagline, { textAlign: 'center', marginTop: 24, fontSize: 18 }]}>
            Find friends, courts, and your next game - all in one app!
          </Text>
        </View>

        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <View style={styles.bulletPoint}>
              <Text style={styles.bulletText}>•</Text>
            </View>
            <Text style={styles.featureText}>Live court activity maps</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.bulletPoint}>
              <Text style={styles.bulletText}>•</Text>
            </View>
            <Text style={styles.featureText}>See where your friends are playing</Text>
          </View>

          <View style={styles.featureItem}>
            <View style={styles.bulletPoint}>
              <Text style={styles.bulletText}>•</Text>
            </View>
            <Text style={styles.featureText}>Skill level info for better matchups</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={buttonStyles.primary}
            onPress={() => router.push('/auth')}
          >
            <Text style={buttonStyles.text}>Get Started</Text>
          </TouchableOpacity>
          
          <View style={styles.pickleballGraphic}>
            <Text style={styles.pickleballText}>🏓 🎾 🏓</Text>
          </View>
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
    paddingTop: 80,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: colors.primary,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 26,
    paddingHorizontal: 20,
  },
  featuresContainer: {
    marginBottom: 48,
    paddingHorizontal: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  bulletPoint: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  featureText: {
    fontSize: 17,
    fontWeight: '500',
    color: colors.text,
    flex: 1,
    lineHeight: 24,
  },
  buttonContainer: {
    width: '100%',
  },
  pickleballGraphic: {
    marginTop: 32,
    alignItems: 'center',
  },
  pickleballText: {
    fontSize: 32,
  },
});
