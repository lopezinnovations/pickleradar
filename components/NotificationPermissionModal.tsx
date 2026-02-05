
import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface NotificationPermissionModalProps {
  visible: boolean;
  onEnable: () => void;
  onNotNow: () => void;
}

export function NotificationPermissionModal({
  visible,
  onEnable,
  onNotNow,
}: NotificationPermissionModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onNotNow}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.iconContainer}>
            <IconSymbol
              ios_icon_name="bell.fill"
              android_material_icon_name="notifications"
              size={48}
              color={colors.primary}
            />
          </View>

          <Text style={styles.title}>Enable Notifications</Text>
          <Text style={styles.message}>
            Enable notifications so you don&apos;t miss messages from your friends
          </Text>

          <TouchableOpacity style={styles.enableButton} onPress={onEnable}>
            <Text style={styles.enableButtonText}>Enable</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.notNowButton} onPress={onNotNow}>
            <Text style={styles.notNowButtonText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.highlight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  enableButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  enableButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.card,
  },
  notNowButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  notNowButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textSecondary,
  },
});
