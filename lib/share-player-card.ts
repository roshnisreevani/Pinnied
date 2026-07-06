import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Alert } from 'react-native';
import type ViewShot from 'react-native-view-shot';

async function captureCard(ref: RefObject<ViewShot | null>): Promise<string | null> {
  const capture = ref.current?.capture;
  if (!capture) return null;
  return capture();
}

export async function shareQrCard(ref: RefObject<ViewShot | null>): Promise<void> {
  const uri = await captureCard(ref);
  if (!uri) return;

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    Alert.alert("Can't share right now", 'Sharing is not available on this device.');
    return;
  }

  await Sharing.shareAsync(uri, {
    mimeType: 'image/png',
    dialogTitle: 'Share your Rec QR code',
    UTI: 'public.png',
  });
}

export async function saveQrCardToPhotos(ref: RefObject<ViewShot | null>): Promise<void> {
  const uri = await captureCard(ref);
  if (!uri) return;

  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', 'Enable photo access in Settings to save your QR code.');
    return;
  }

  await MediaLibrary.saveToLibraryAsync(uri);
  Alert.alert('Saved', 'Your QR code was saved to your photos.');
}
