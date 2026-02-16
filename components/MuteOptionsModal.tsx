import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';

interface MuteOption {
  label: string;
  value: number | null; // null means "until I turn it back on"
}

const MUTE_OPTIONS: MuteOption[] = [
  { label: '1 hour', value: 60 },
  { label: '8 hours', value: 480 },
  { label: '24 hours', value: 1440 },
  { label: 'Until I turn it back on', value: null },
];

interface MuteOptionsModalProps {
  visible: boolean;
  onClose: () => void;

  // ✅ Actual API used by ConversationScreen
  isMuted?: boolean;
  onMute?: (minutes: number | null) => void;
  onUnmute?: () => void;
}

export function MuteOptionsModal({
  visible,
  onClose,
  isMuted = false,
  onMute,
  onUnmute,
}: MuteOptionsModalProps) {
  const handleSelectMute = (minutes: number | null) => {
    if (typeof onMute !== 'function') {
      console.log('[MuteOptionsModal] onMute not provided');
      Alert.alert('Not available', 'Mute action is not connected yet on this screen.');
      onClose();
      return;
    }

    onMute(minutes);
    onClose();
  };

  const handleUnmutePress = () => {
    if (typeof onUnmute !== 'function') {
      console.log('[MuteOptionsModal] onUnmute not provided');
      Alert.alert('Not available', 'Unmute action is not connected yet on this screen.');
      onClose();
      return;
    }

    onUnmute();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>Mute notifications</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <IconSymbol
                ios_icon_name="xmark"
                android_material_icon_name="close"
                size={24}
                color={colors.text}
              />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={false}>
            {isMuted && (
              <TouchableOpacity style={[styles.optionItem, styles.unmuteItem]} onPress={handleUnmutePress}>
                <Text style={[styles.optionText, styles.unmuteText]}>Turn mute off</Text>
                <IconSymbol
                  ios_icon_name="bell"
                  android_material_icon_name="notifications"
                  size={20}
                  color={colors.primary}
                />
              </TouchableOpacity>
            )}

            {MUTE_OPTIONS.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.optionItem}
                onPress={() => handleSelectMute(option.value)}
              >
                <Text style={styles.optionText}>{option.label}</Text>
                <IconSymbol
                  ios_icon_name="chevron.right"
                  android_material_icon_name="chevron_right"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.bottomSpacer} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 12,
    maxHeight: '60%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  closeButton: {
    padding: 4,
  },
  optionsList: {
    paddingHorizontal: 20,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: {
    fontSize: 16,
    color: colors.text,
  },
  unmuteItem: {
    backgroundColor: colors.highlight,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginTop: 12,
    marginBottom: 4,
    borderBottomWidth: 0,
  },
  unmuteText: {
    color: colors.primary,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 24,
  },
});
