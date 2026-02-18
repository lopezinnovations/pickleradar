/**
 * TEMPORARY: Root error boundary for white-screen debugging.
 * Catches runtime errors and shows them on screen instead of a blank white screen.
 * Remove or replace with a user-friendly fallback after stabilization.
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <ScrollView style={styles.scroll}>
            <Text style={styles.stack}>
              {this.state.error.stack ?? 'No stack trace'}
            </Text>
            {this.state.errorInfo?.componentStack && (
              <Text style={[styles.stack, { marginTop: 16 }]}>
                {this.state.errorInfo.componentStack}
              </Text>
            )}
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#ff6b6b', marginBottom: 8 },
  message: { fontSize: 16, color: '#fff', marginBottom: 16 },
  scroll: { maxHeight: 300 },
  stack: {
    fontSize: 12,
    color: '#aaa',
    fontFamily: 'monospace',
  },
});
