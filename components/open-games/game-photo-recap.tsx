import { ImagePlus, Lock, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import { errorMessage } from '@/lib/error-message';
import { reportContent } from '@/lib/moderation';
import { addGamePhoto, deleteGamePhoto, fetchGamePhotos, MAX_GAME_PHOTOS, type GamePhoto } from '@/lib/open-games';
import { pickPhoto } from '@/lib/pick-photo';
import { uploadGamePhoto } from '@/lib/upload-photo';

type Props = {
  gameId: string;
  userId: string;
  photosPublic: boolean;
  canAdd: boolean;
};

export function GamePhotoRecap({ gameId, userId, photosPublic, canAdd }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [photos, setPhotos] = useState<GamePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      setPhotos(await fetchGamePhotos(gameId, userId));
    } catch {
      // quiet fail — photos are supplementary
    } finally {
      setLoading(false);
    }
  }, [gameId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const atCap = photos.length >= MAX_GAME_PHOTOS;

  const handleAdd = async () => {
    if (atCap) {
      Alert.alert('Album is full', `This game has hit the ${MAX_GAME_PHOTOS}-photo limit.`);
      return;
    }
    const uri = await pickPhoto();
    if (!uri) return;
    setUploading(true);
    try {
      const url = await uploadGamePhoto(userId, uri);
      await addGamePhoto(gameId, userId, url);
      await load();
    } catch (e) {
      Alert.alert('Could not add photo', errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (photo: GamePhoto) => {
    if (photo.userId !== userId) return;
    Alert.alert('Delete this photo?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGamePhoto(photo.id);
            setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
          } catch (e) {
            Alert.alert('Could not delete', errorMessage(e));
          }
        },
      },
    ]);
  };

  const handleLongPress = (photo: GamePhoto) => {
    if (photo.userId === userId) {
      handleDelete(photo);
      return;
    }
    Alert.alert('Report this photo?', "We'll take a look and remove it if it breaks the rules.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          try {
            await reportContent(userId, 'game_photo', photo.id, 'inappropriate');
            Alert.alert('Reported', 'Thanks for flagging it.');
          } catch (e) {
            Alert.alert('Could not report', errorMessage(e));
          }
        },
      },
    ]);
  };

  if (loading) return null;
  if (photos.length === 0 && !canAdd) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Photos ({photos.length})</Text>
        <View style={styles.visibilityPill}>
          {!photosPublic ? <Lock size={10} color={colors.textSecondary} strokeWidth={2.5} /> : null}
          <Text style={styles.visibilityText}>{photosPublic ? 'Public in Discover' : 'Private to the group'}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {canAdd && !atCap ? (
          <AnimatedPressable style={styles.addTile} onPress={handleAdd} disabled={uploading}>
            {uploading ? <ActivityIndicator color={colors.text} size="small" /> : <ImagePlus size={22} color={colors.textSecondary} strokeWidth={2} />}
          </AnimatedPressable>
        ) : null}
        {photos.map((photo) => (
          <AnimatedPressable key={photo.id} style={styles.photoTile} onLongPress={() => handleLongPress(photo)}>
            <Image source={{ uri: photo.photoUrl }} style={styles.photoImage} />
            {photo.userId === userId ? (
              <View style={styles.deleteBadge}>
                <Trash2 size={11} color="#fff" strokeWidth={2.5} />
              </View>
            ) : null}
          </AnimatedPressable>
        ))}
        {photos.length === 0 && !canAdd ? (
          <Text style={styles.emptyText}>No photos yet.</Text>
        ) : null}
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { width: '100%', marginTop: 26, gap: 10 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    title: { fontSize: 13, fontWeight: WEIGHT.bold, color: colors.text },
    visibilityPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.borderSoft,
      borderRadius: RADII.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    visibilityText: { fontSize: 10, fontWeight: WEIGHT.semibold, color: colors.textSecondary },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    addTile: {
      width: 96,
      height: 96,
      borderRadius: RADII.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoTile: { width: 96, height: 96, borderRadius: RADII.md, overflow: 'hidden' },
    photoImage: { width: '100%', height: '100%' },
    deleteBadge: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: RADII.pill,
      padding: 4,
    },
    emptyText: { fontSize: 12, color: colors.textSecondary, paddingVertical: 8 },
  });
}
