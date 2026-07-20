import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OpenGameForm, type OpenGameFormValues } from '@/components/open-games/open-game-form';
import { useThemeColors } from '@/contexts/theme-context';
import { useAuth } from '@/contexts/auth-context';
import { createOpenGame } from '@/lib/open-games';

export default function CreateOpenGameScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();
  const colors = useThemeColors();

  const handleSubmit = async (values: OpenGameFormValues) => {
    if (!userId) return;
    const gameId = await createOpenGame({ createdBy: userId, ...values });
    router.replace(`/open-game/${gameId}`);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
      <OpenGameForm mode="create" onSubmit={handleSubmit} />
    </SafeAreaView>
  );
}
