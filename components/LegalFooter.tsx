
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/styles/commonStyles';
import { BrandingFooter } from './BrandingFooter';

interface LegalFooterProps {
  showLegalCompliance?: boolean;
  onLegalCompliancePress?: () => void;
  showDeleteAccount?: boolean;
  onDeleteAccountPress?: () => void;
  deletingAccount?: boolean;
}

export function LegalFooter({ 
  showLegalCompliance = false, 
  onLegalCompliancePress,
  showDeleteAccount = false,
  onDeleteAccountPress,
  deletingAccount = false
}: LegalFooterProps) {
  const router = useRouter();

  const handleContactPress = () => {
    Linking.openURL('mailto:lopezinnovations.co@gmail.com');
  };

  return (
    <View style={styles.footer}>
      <View style={styles.linksContainer}>
        <TouchableOpacity onPress={handleContactPress}>
          <Text style={styles.link}>Contact Support</Text>
        </TouchableOpacity>
        
        <Text style={styles.separator}>•</Text>
        
        <TouchableOpacity onPress={() => router.push('/legal/privacy-policy')}>
          <Text style={styles.link}>Privacy Policy</Text>
        </TouchableOpacity>
        
        <Text style={styles.separator}>•</Text>
        
        <TouchableOpacity onPress={() => router.push('/legal/terms-of-service')}>
          <Text style={styles.link}>Terms of Service</Text>
        </TouchableOpacity>
        
        <Text style={styles.separator}>•</Text>
        
        <TouchableOpacity onPress={() => router.push('/legal/disclaimer')}>
          <Text style={styles.link}>Disclaimer</Text>
        </TouchableOpacity>

        {showLegalCompliance && onLegalCompliancePress && (
          <React.Fragment>
            <Text style={styles.separator}>•</Text>
            <TouchableOpacity onPress={onLegalCompliancePress}>
              <Text style={[styles.link, { color: colors.success }]}>Legal Compliance</Text>
            </TouchableOpacity>
          </React.Fragment>
        )}

        {showDeleteAccount && onDeleteAccountPress && (
          <React.Fragment>
            <Text style={styles.separator}>•</Text>
            <TouchableOpacity onPress={onDeleteAccountPress} disabled={deletingAccount}>
              {deletingAccount ? (
                <ActivityIndicator color={colors.accent} size="small" />
              ) : (
                <Text style={[styles.link, { color: colors.accent }]}>Delete Account</Text>
              )}
            </TouchableOpacity>
          </React.Fragment>
        )}
      </View>
      
      <Text style={styles.copyright}>
        © 2025 PickleRadar. All rights reserved.
      </Text>
      
      <BrandingFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  linksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  link: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  separator: {
    fontSize: 13,
    color: colors.textSecondary,
    paddingHorizontal: 4,
  },
  copyright: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
