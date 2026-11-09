import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { Alert, Linking, Text, View } from 'react-native';

import { PressableScale } from '@/components/motion';
import { radius, spacing } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';
import type { BillFile } from '@/hooks/use-bill-scan';
import { haptics } from '@/lib/haptics';

const PICK_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.7,
};

// Take a photo of the bill with the camera, or pick one from the gallery (or a
// PDF bill). Built for people who may not read well: two large picture
// buttons, then a big preview with "take again" and "remove". `children`
// shows under the preview (e.g. what was read from the bill).
export function BillPhoto({
  value,
  onChange,
  children,
}: {
  value: BillFile | null;
  onChange: (file: BillFile | null) => void;
  children?: React.ReactNode;
}) {
  const styles = useStyles();
  const colors = useColors();

  const accept = (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]) return;
    const { uri, width, height, fileName } = result.assets[0];
    haptics.success();
    onChange({ uri, width, height, kind: 'image', name: fileName ?? 'bill.jpg' });
  };

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    haptics.success();
    onChange({ uri: result.assets[0].uri, kind: 'pdf', name: result.assets[0].name || 'bill.pdf' });
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera is off', 'Allow the camera to take a photo of your bill.', [
        { text: 'Not now', style: 'cancel' },
        ...(permission.canAskAgain ? [] : [{ text: 'Open settings', onPress: () => void Linking.openSettings() }]),
      ]);
      return;
    }
    accept(await ImagePicker.launchCameraAsync(PICK_OPTIONS));
  };

  const pickFromGallery = async () => {
    accept(await ImagePicker.launchImageLibraryAsync(PICK_OPTIONS));
  };

  if (value) {
    return (
      <View style={styles.previewCard}>
        {value.kind === 'pdf' ? (
          <View style={styles.pdf}>
            <Ionicons name="document-text" size={40} color={colors.primary} />
            <Text style={styles.pdfName} numberOfLines={2}>
              {value.name}
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri: value.uri }}
            style={[styles.preview, { aspectRatio: value.width && value.height ? value.width / value.height : 3 / 4 }]}
            contentFit="cover"
            accessibilityLabel="Photo of your bill"
          />
        )}
        {children}
        <View style={styles.previewActions}>
          <PressableScale
            haptic="tap"
            onPress={takePhoto}
            accessibilityRole="button"
            accessibilityLabel="Take a new photo of the bill"
            style={styles.smallButton}>
            <Ionicons name="camera-reverse-outline" size={22} color={colors.primary} />
            <Text style={styles.smallButtonText}>New photo</Text>
          </PressableScale>
          <PressableScale
            haptic="tap"
            onPress={() => onChange(null)}
            accessibilityRole="button"
            accessibilityLabel="Remove the photo"
            style={styles.smallButton}>
            <Ionicons name="trash-outline" size={22} color={colors.danger} />
            <Text style={[styles.smallButtonText, { color: colors.danger }]}>Remove</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.previewCard}>
      <View style={styles.choices}>
        <PressableScale
          haptic="tap"
          onPress={takePhoto}
          accessibilityRole="button"
          accessibilityLabel="Take a photo of the bill"
          style={[styles.bigButton, styles.bigButtonPrimary]}>
          <Ionicons name="camera" size={40} color="#FFFFFF" />
          <Text style={[styles.bigButtonText, styles.bigButtonTextPrimary]}>Take photo</Text>
        </PressableScale>
        <PressableScale
          haptic="tap"
          onPress={pickFromGallery}
          accessibilityRole="button"
          accessibilityLabel="Choose a bill photo from the gallery"
          style={styles.bigButton}>
          <Ionicons name="images-outline" size={40} color={colors.primary} />
          <Text style={styles.bigButtonText}>From gallery</Text>
        </PressableScale>
      </View>
      <PressableScale
        haptic="tap"
        onPress={pickPdf}
        accessibilityRole="button"
        accessibilityLabel="Choose a PDF bill"
        style={styles.pdfLink}>
        <Ionicons name="document-attach-outline" size={20} color={colors.primary} />
        <Text style={styles.smallButtonText}>Bill is a PDF file</Text>
      </PressableScale>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  choices: {
    flexDirection: 'row',
    gap: spacing.three,
  },
  bigButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.two,
    minHeight: 120,
    borderRadius: radius.large,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    padding: spacing.four,
  },
  bigButtonPrimary: {
    borderStyle: 'solid',
    backgroundColor: colors.primary,
  },
  bigButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  bigButtonTextPrimary: {
    color: '#FFFFFF',
  },
  previewCard: {
    gap: spacing.three,
  },
  preview: {
    width: '100%',
    maxHeight: 360,
    borderRadius: radius.large,
    backgroundColor: colors.borderLight,
  },
  pdf: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    padding: spacing.four,
    borderRadius: radius.large,
    backgroundColor: colors.primarySoft,
  },
  pdfName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pdfLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.two,
    minHeight: 44,
  },
  previewActions: {
    flexDirection: 'row',
    gap: spacing.three,
  },
  smallButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.two,
    minHeight: 52,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  smallButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
}));
