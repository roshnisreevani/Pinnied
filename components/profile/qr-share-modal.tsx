import { useMemo, useRef, useState } from 'react';
import { Alert, Modal, StyleSheet, Text, View } from 'react-native';
import type ViewShot from 'react-native-view-shot';

import { PlayerCard } from '@/components/profile/player-card';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import { getProfileShareUrl } from '@/lib/profile-url';
import { saveQrCardToPhotos, shareQrCard } from '@/lib/share-player-card';

type Props = {
  visible: boolean;
  onClose: () => void;
  userId: string;
  name: string;
};

export function QrShareModal({ visible, onClose, userId, name }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const cardRef = useRef<ViewShot>(null);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);

  const profileUrl = getProfileShareUrl(userId);

  const handleShare = async () => {
    setBusy('share');
    try {
      await shareQrCard(cardRef);
    } catch (e) {
      Alert.alert('Could not share', e instanceof Error ? e.message : 'Unknown error.');
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    setBusy('save');
    try {
      await saveQrCardToPhotos(cardRef);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <PlayerCard ref={cardRef} name={name} profileUrl={profileUrl} />

          <View style={styles.actions}>
            <AnimatedPressable style={styles.secondaryButton} onPress={handleSave} disabled={busy !== null}>
              <Text style={styles.secondaryButtonText}>{busy === 'save' ? 'Saving…' : 'Save to Photos'}</Text>
            </AnimatedPressable>
            <AnimatedPressable style={styles.primaryButton} onPress={handleShare} disabled={busy !== null}>
              <Text style={styles.primaryButtonText}>{busy === 'share' ? 'Sharing…' : 'Share'}</Text>
            </AnimatedPressable>
          </View>

          <AnimatedPressable onPress={onClose} hitSlop={8} style={styles.closeRow}>
            <Text style={styles.closeText}>Close</Text>
          </AnimatedPressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    sheet: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.background,
      borderRadius: RADII.lg,
      padding: 20,
      alignItems: 'center',
      gap: 16,
    },
    actions: { flexDirection: 'row', gap: 10, width: '100%' },
    secondaryButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: RADII.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    secondaryButtonText: { fontWeight: WEIGHT.semibold, fontSize: 14, color: colors.text },
    primaryButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: RADII.md,
      backgroundColor: colors.coral,
    },
    primaryButtonText: { fontWeight: WEIGHT.semibold, fontSize: 14, color: ON_ACCENT },
    closeRow: { paddingTop: 2 },
    closeText: { fontSize: 13, color: colors.textSecondary },
  });
}
