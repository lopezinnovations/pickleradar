
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

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
          <View style={styles.logoContainer}>
            <Text style={styles.paddleEmoji}>🏓</Text>
          </View>
          <Text style={[commonStyles.title, { fontSize: 36, marginTop: 20, color: colors.primary }]}>
            PickleRadar
          </Text>
          <Text style={[commonStyles.text, { textAlign: 'center', marginTop: 12, fontSize: 18 }]}>
            Welcome to PickleRadar – find friends and courts!
          </Text>
        </View>

        <View style={styles.featuresContainer}>
          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.highlight }]}>
              <IconSymbol 
                ios_icon_name="map.circle.fill" 
                android_material_icon_name="location_on" 
                size={32} 
                color={colors.primary} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Real-Time Court Activity</Text>
              <Text style={commonStyles.textSecondary}>
                See which courts are active right now with live player counts
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.highlight }]}>
              <IconSymbol 
                ios_icon_name="person.2.fill" 
                android_material_icon_name="people" 
                size={32} 
                color={colors.primary} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Connect with Friends</Text>
              <Text style={commonStyles.textSecondary}>
                Know when your friends are playing and join them on the court
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.highlight }]}>
              <IconSymbol 
                ios_icon_name="bell.fill" 
                android_material_icon_name="notifications" 
                size={32} 
                color={colors.primary} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Smart Notifications</Text>
              <Text style={commonStyles.textSecondary}>
                Get notified when friends check in or nearby courts become active
              </Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <View style={[styles.featureIcon, { backgroundColor: colors.highlight }]}>
              <IconSymbol 
                ios_icon_name="lock.shield.fill" 
                android_material_icon_name="shield" 
                size={32} 
                color={colors.primary} 
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.featureTitle}>Privacy First</Text>
              <Text style={commonStyles.textSecondary}>
                Your location is private. Share only with friends you choose
              </Text>
            </View>
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
  },
  paddleEmoji: {
    fontSize: 64,
  },
  featuresContainer: {
    marginBottom: 40,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  featureIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  featureTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  buttonContainer: {
    width: '100%',
  },
  pickleballGraphic: {
    marginTop: 24,
    alignItems: 'center',
  },
  pickleballText: {
    fontSize: 32,
  },
});
