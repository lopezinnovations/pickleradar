
import { Stack } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/styles/commonStyles';
import * as Notifications from 'expo-notifications';
import { isPushNotificationSupported } from '@/utils/notifications';

// Global error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    console.log('ErrorBoundary: Caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.log('ErrorBoundary: Error details:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>
            Please restart the app. If the problem persists, contact support.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={styles.errorDetails}>{this.state.error.toString()}</Text>
          )}
        </View>
      );
    }

    return this.props.children;
  }
}

export default function RootLayout() {
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  useEffect(() => {
    console.log('RootLayout: App initialized');

    // Only initialize push notifications in development or production builds
    // NOT in Expo Go on Android (due to SDK 53 change)
    if (!isPushNotificationSupported()) {
      console.log('[Push] Push notifications not supported in this environment');
      console.log('[Push] To test push notifications:');
      console.log('[Push] - iOS: Use TestFlight or a Development Build');
      console.log('[Push] - Android: Use a Development Build (Expo Go does not support push on SDK 53+)');
      return;
    }

    console.log('[Push] Setting up notification listeners');

    // Listen for notifications received while app is foregrounded
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('[Push] Notification received:', notification);
    });

    // Listen for user interactions with notifications
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('[Push] Notification response received:', response);
      // Handle notification tap - navigate to relevant screen based on notification data
      const data = response.notification.request.content.data;
      console.log('[Push] Notification data:', data);
    });

    return () => {
      console.log('[Push] Cleaning up notification listeners');
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  return (
    <ErrorBoundary>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="conversation/[id]" />
        <Stack.Screen name="legal/terms-of-service" />
        <Stack.Screen name="legal/privacy-policy" />
        <Stack.Screen name="legal/disclaimer" />
      </Stack>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: 20,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorDetails: {
    fontSize: 12,
    color: colors.error,
    textAlign: 'center',
    marginTop: 20,
  },
});
