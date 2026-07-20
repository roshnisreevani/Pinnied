import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OpenGameForm, type OpenGameFormValues } from '@/components/open-games/open-game-form';
import { useThemeColors } from '@/contexts/theme-context';
import { fetchOpenGame, updateOpenGame, type OpenGame } from '@/lib/open-games';

export default function EditOpenGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colors = useThemeColors();

  const [game, setGame] = useState<OpenGame | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      fetchOpenGame(id)
        .then(setGame)
        .finally(() => setLoading(false));
    }, [id])
  );

  const handleSubmit = async (values: OpenGameFormValues) => {
    if (!id) return;
    await updateOpenGame(id, values);
    router.back();
  };

  if (loading || !game) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator color={colors.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <OpenGameForm
        mode="edit"
        initialValues={{
          sport: game.sport,
          title: game.title,
          description: game.description,
          skillLevel: game.skillLevel,
          locationName: game.locationName,
          latitude: game.latitude,
          longitude: game.longitude,
          startsAt: game.startsAt,
          maxSpots: game.maxSpots,
        }}
        onSubmit={handleSubmit}
      />
    </SafeAreaView>
  );
}
