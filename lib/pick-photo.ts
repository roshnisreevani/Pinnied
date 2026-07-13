import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import type { MediaType } from '@/lib/posts';

export type PickedMedia = { uri: string; type: MediaType };

function toPickedMedia(result: ImagePicker.ImagePickerResult): PickedMedia | null {
  if (result.canceled) return null;
  const asset = result.assets[0];
  return { uri: asset.uri, type: asset.type === 'video' ? 'video' : 'image' };
}

/**
 * Photo-or-video variant of pickPhoto below, same camera/library Alert flow
 * and permission handling — used by post composers (feed and group posts).
 */
export function pickMedia(): Promise<PickedMedia | null> {
  return new Promise((resolve) => {
    Alert.alert('Add photo or video', undefined, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      {
        text: 'Take Photo or Video',
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('No access', 'Need camera access to capture media.');
            resolve(null);
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.7,
          });
          resolve(toPickedMedia(result));
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('No access', 'Need photo library access to choose media.');
            resolve(null);
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.7,
          });
          resolve(toPickedMedia(result));
        },
      },
    ]);
  });
}

/**
 * Shared "add a photo" flow used by the avatar and Pick Your 3 pickers.
 * Offers camera or library, handles permissions for both, and resolves with
 * a local file:// URI (or null if the user backed out).
 */
export function pickPhoto(): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert('Add a photo', undefined, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      {
        text: 'Take Photo',
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('No access', 'Need camera access to take a photo.');
            resolve(null);
            return;
          }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          resolve(result.canceled ? null : result.assets[0].uri);
        },
      },
      {
        text: 'Choose from Library',
        onPress: async () => {
          const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!permission.granted) {
            Alert.alert('No access', 'Need photo library access to choose a photo.');
            resolve(null);
            return;
          }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });
          resolve(result.canceled ? null : result.assets[0].uri);
        },
      },
    ]);
  });
}
