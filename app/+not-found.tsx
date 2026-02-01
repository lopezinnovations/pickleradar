
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, commonStyles, buttonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

export default function NotFoundScreen() {
  const router = useRouter();

  const handleGoHome = () => {
    console.log('NotFoundScreen: Navigating to home');
    router.replace('/(tabs)/(home)/');
  };

  return (
    <View style={styles.container}>
      <IconSymbol 
        ios_icon_name="exclamationmark.triangle" 
        android_material_icon_name="warning" 
        size={64} 
        color={colors.textSecondary} 
      />
      <Text style={styles.title}>Page Not Found</Text>
      <Text style={styles.message}>
        The page you're looking for doesn't exist.
      </Text>
      <TouchableOpacity 
        style={[buttonStyles.primary, styles.button]} 
        onPress={handleGoHome}
      >
        <Text style={buttonStyles.primaryText}>Go to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    minWidth: 200,
  },
});
