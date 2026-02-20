
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function DisclaimerScreen() {
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
        <Text style={[commonStyles.title, { color: colors.primary }]}>Disclaimer</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.lastUpdated}>Last Updated: January 2025</Text>
        <Text style={styles.version}>Version: v1.0</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General Disclaimer</Text>
          <Text style={styles.paragraph}>
            The information provided by PickleRadar (&quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) through the mobile application is for general informational purposes only. All information is provided in good faith, however we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information in the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>No Professional Advice</Text>
          <Text style={styles.paragraph}>
            The App does not provide professional advice of any kind. Any reliance you place on information from the App is strictly at your own risk. We recommend that you consult with appropriate professionals before making any decisions based on information from the App.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Court Information Accuracy</Text>
          <Text style={styles.paragraph}>
            Court locations, addresses, hours of operation, and other details are provided for informational purposes only. We do not guarantee:
          </Text>
          <Text style={styles.bulletPoint}>- The accuracy of court locations or addresses</Text>
          <Text style={styles.bulletPoint}>- Current availability of courts</Text>
          <Text style={styles.bulletPoint}>- Court conditions, safety, or maintenance status</Text>
          <Text style={styles.bulletPoint}>- Hours of operation or access restrictions</Text>
          <Text style={styles.bulletPoint}>- Amenities or facilities at courts</Text>
          <Text style={styles.paragraph}>
            Always verify court information independently before visiting. Contact local authorities or court operators for the most current information.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>User-Generated Content</Text>
          <Text style={styles.paragraph}>
            The App may contain content submitted by users, including court information, photos, ratings, and comments. We do not verify, endorse, or guarantee the accuracy of user-generated content. User opinions and experiences may not reflect our views or the actual conditions at any location.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Activity and Safety</Text>
          <Text style={styles.paragraph}>
            Pickleball and other physical activities carry inherent risks. By using the App to find courts and connect with other players, you acknowledge that:
          </Text>
          <Text style={styles.bulletPoint}>- You participate in physical activities at your own risk</Text>
          <Text style={styles.bulletPoint}>- We are not responsible for injuries or accidents</Text>
          <Text style={styles.bulletPoint}>- You should assess your own fitness level and abilities</Text>
          <Text style={styles.bulletPoint}>- You should follow all safety guidelines and rules</Text>
          <Text style={styles.bulletPoint}>- You should use appropriate equipment and protective gear</Text>
          <Text style={styles.paragraph}>
            Consult with a healthcare professional before beginning any exercise program.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Real-Time Information</Text>
          <Text style={styles.paragraph}>
            Check-in data and court activity levels are based on user-reported information and may not reflect actual current conditions. Activity indicators are estimates only and should not be relied upon as accurate representations of court occupancy or availability.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Third-Party Interactions</Text>
          <Text style={styles.paragraph}>
            The App facilitates connections between users but we are not responsible for:
          </Text>
          <Text style={styles.bulletPoint}>- Interactions between users</Text>
          <Text style={styles.bulletPoint}>- Behavior of other users</Text>
          <Text style={styles.bulletPoint}>- Disputes between users</Text>
          <Text style={styles.bulletPoint}>- Safety of in-person meetings</Text>
          <Text style={styles.paragraph}>
            Exercise caution when meeting people you connect with through the App. Meet in public places and follow personal safety guidelines.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Services</Text>
          <Text style={styles.paragraph}>
            Location-based features rely on device GPS and may not always be accurate. Location data can be affected by various factors including device settings, signal strength, and environmental conditions. We are not responsible for inaccuracies in location-based information.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>External Links</Text>
          <Text style={styles.paragraph}>
            The App may contain links to external websites or services. We have no control over and assume no responsibility for the content, privacy policies, or practices of any third-party sites or services.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Service Availability</Text>
          <Text style={styles.paragraph}>
            We do not guarantee that the App will be available at all times or that it will be error-free. We reserve the right to modify, suspend, or discontinue any part of the App at any time without notice.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Limitation of Liability</Text>
          <Text style={styles.paragraph}>
            TO THE FULLEST EXTENT PERMITTED BY LAW, PICKLERADAR SHALL NOT BE LIABLE FOR ANY DAMAGES OF ANY KIND ARISING FROM THE USE OF THE APP, INCLUDING BUT NOT LIMITED TO DIRECT, INDIRECT, INCIDENTAL, PUNITIVE, AND CONSEQUENTIAL DAMAGES.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Changes to Disclaimer</Text>
          <Text style={styles.paragraph}>
            We reserve the right to update this Disclaimer at any time. Changes will be effective immediately upon posting with an updated &quot;Last Updated&quot; date and version number.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have questions about this Disclaimer, please contact us through the App or at our support channels.
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
