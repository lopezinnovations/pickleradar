
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { colors } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from "@/lib/supabase/client";
import { useAuth } from '@/hooks/useAuth';
import { geocodeZipCode } from '@/utils/locationUtils';

interface AddCourtModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const GEOCODE_TIMEOUT_MS = 10000;

export function AddCourtModal({ visible, onClose, onSuccess }: AddCourtModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setAddress('');
    setCity('');
    setZipCode('');
  };

  const handleSubmit = async () => {
    if (!user) {
      if (__DEV__) console.log('[AddCourt] submit pressed – not logged in');
      Alert.alert('Error', 'You must be logged in to submit a court');
      return;
    }

    const trimmedName = name.trim();
    const trimmedAddress = address.trim();
    if (!trimmedName || !trimmedAddress) {
      if (__DEV__) console.log('[AddCourt] submit pressed – validation failed (name/address required)');
      Alert.alert('Error', 'Please fill in court name and address');
      return;
    }

    if (__DEV__) console.log('[AddCourt] submit pressed – validation passed');
    setSubmitting(true);

    try {
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (zipCode.trim() && Platform.OS !== 'web') {
        try {
          const geocodePromise = geocodeZipCode(zipCode.trim());
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Geocode timeout')), GEOCODE_TIMEOUT_MS)
          );
          const geocodeResult = await Promise.race([geocodePromise, timeoutPromise]);
          if (geocodeResult.success && geocodeResult.latitude != null && geocodeResult.longitude != null) {
            const lat = Number(geocodeResult.latitude);
            const lng = Number(geocodeResult.longitude);
            if (Number.isFinite(lat) && Number.isFinite(lng)) {
              latitude = lat;
              longitude = lng;
            }
          }
        } catch (geocodeErr) {
          if (__DEV__) console.warn('[AddCourt] Geocode failed, continuing without coordinates:', geocodeErr);
        }
      } else if (zipCode.trim() && Platform.OS === 'web') {
        if (__DEV__) console.log('[AddCourt] Skipping geocode on web (may be unavailable)');
      }

      if (__DEV__) console.log('[AddCourt] Inserting court...');
      const insertPayload = {
        user_id: user.id,
        name: trimmedName,
        address: trimmedAddress,
        city: city.trim() || null,
        zip_code: zipCode.trim() || null,
        latitude,
        longitude,
      };

      const { error: insertError } = await supabase
        .from('user_submitted_courts')
        .insert(insertPayload);

      if (insertError) {
        if (__DEV__) console.error('[AddCourt] Insert error:', insertError?.message ?? insertError);
        Alert.alert('Error', insertError?.message ?? 'Failed to submit court. Please try again.');
        return;
      }

      if (__DEV__) console.log('[AddCourt] Insert success');

      // Fire-and-forget notify – do not block or hang the UI
      Promise.resolve().then(async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await fetch('https://biczbxmaisdxpcbplddr.supabase.co/functions/v1/notify-new-court', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              courtData: {
                name: trimmedName,
                address: trimmedAddress,
                city: city.trim(),
                zip_code: zipCode.trim(),
                user_email: user.email ?? undefined,
              },
            }),
          });
        } catch (notifyError) {
          if (__DEV__) console.warn('[AddCourt] Notify failed (non-critical):', notifyError);
        }
      });

      Alert.alert(
        'Success!',
        'Thank you for submitting a new court! We\'ll review it and add it to the map soon.',
        [
          {
            text: 'OK',
            onPress: () => {
              resetForm();
              onClose();
              onSuccess();
            },
          },
        ]
      );
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'An unexpected error occurred';
      if (__DEV__) console.error('[AddCourt] handleSubmit error:', error);
      Alert.alert('Error', `${errMsg}. Please try again.`);
    } finally {
      setSubmitting(false);
      if (__DEV__) console.log('[AddCourt] Submit flow complete (loading cleared)');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} disabled={submitting}>
            <IconSymbol
              ios_icon_name="xmark.circle.fill"
              android_material_icon_name="cancel"
              size={28}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Add New Court</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          style={styles.modalContent}
          contentContainerStyle={styles.modalContentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionTitle}>Court Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Court Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Central Park Pickleball Courts"
              placeholderTextColor={colors.textSecondary}
              value={name}
              onChangeText={setName}
              editable={!submitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 123 Main St"
              placeholderTextColor={colors.textSecondary}
              value={address}
              onChangeText={setAddress}
              editable={!submitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>City</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., New York"
              placeholderTextColor={colors.textSecondary}
              value={city}
              onChangeText={setCity}
              editable={!submitting}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>ZIP Code</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., 10001"
              placeholderTextColor={colors.textSecondary}
              value={zipCode}
              onChangeText={setZipCode}
              keyboardType="number-pad"
              maxLength={5}
              editable={!submitting}
            />
          </View>

          <Text style={styles.disclaimer}>
            * Required fields. Your submission will be reviewed before being added to the map.
          </Text>
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.card} />
            ) : (
              <Text style={styles.submitButtonText}>Submit Court</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: colors.text,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.card,
  },
});
