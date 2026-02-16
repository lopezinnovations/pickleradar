
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
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, commonStyles } from '@/styles/commonStyles';
import { IconSymbol } from '@/components/IconSymbol';
import { supabase } from '@/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { geocodeZipCode } from '@/utils/locationUtils';

interface AddCourtModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddCourtModal({ visible, onClose, onSuccess }: AddCourtModalProps) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setName('');
    setAddress('');
    setCity('');
    setZipCode('');
    setPhotoUri(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const uploadPhoto = async (uri: string): Promise<string | null> => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileExt = uri.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `court-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('courts')
        .upload(filePath, blob);

      if (uploadError) {
        console.error('Error uploading photo:', uploadError);
        return null;
      }

      const { data } = supabase.storage
        .from('courts')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error) {
      console.error('Error in uploadPhoto:', error);
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit a court');
      return;
    }

    if (!name.trim() || !address.trim()) {
      Alert.alert('Error', 'Please fill in court name and address');
      return;
    }

    setSubmitting(true);

    try {
      // Geocode the address if ZIP code is provided
      let latitude: number | undefined;
      let longitude: number | undefined;

      if (zipCode.trim()) {
        const geocodeResult = await geocodeZipCode(zipCode.trim());
        if (geocodeResult.success) {
          latitude = geocodeResult.latitude;
          longitude = geocodeResult.longitude;
        }
      }

      // Upload photo if provided
      let photoUrl: string | null = null;
      if (photoUri) {
        photoUrl = await uploadPhoto(photoUri);
      }

      // Insert into database
      const { error: insertError } = await supabase
        .from('user_submitted_courts')
        .insert({
          user_id: user.id,
          name: name.trim(),
          address: address.trim(),
          city: city.trim() || null,
          zip_code: zipCode.trim() || null,
          latitude,
          longitude,
          photo_url: photoUrl,
        });

      if (insertError) {
        console.error('Error submitting court:', insertError);
        Alert.alert('Error', 'Failed to submit court. Please try again.');
        setSubmitting(false);
        return;
      }

      // Notify developer via Edge Function
      try {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch('https://biczbxmaisdxpcbplddr.supabase.co/functions/v1/notify-new-court', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            courtData: {
              name: name.trim(),
              address: address.trim(),
              city: city.trim(),
              zip_code: zipCode.trim(),
              user_email: user.email,
              photo_url: photoUrl,
            },
          }),
        });
      } catch (notifyError) {
        console.error('Error notifying developer:', notifyError);
        // Don't fail the submission if notification fails
      }

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
      console.error('Error in handleSubmit:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setSubmitting(false);
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

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Court Photo (Optional)</Text>
            <TouchableOpacity
              style={styles.photoButton}
              onPress={pickImage}
              disabled={submitting}
            >
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <IconSymbol
                    ios_icon_name="camera.fill"
                    android_material_icon_name="photo_camera"
                    size={32}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.photoPlaceholderText}>Tap to add photo</Text>
                </View>
              )}
            </TouchableOpacity>
            {photoUri && (
              <TouchableOpacity
                style={styles.removePhotoButton}
                onPress={() => setPhotoUri(null)}
                disabled={submitting}
              >
                <Text style={styles.removePhotoText}>Remove Photo</Text>
              </TouchableOpacity>
            )}
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
  photoButton: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoPreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: colors.highlight,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  photoPlaceholderText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  removePhotoButton: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  removePhotoText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.error,
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
