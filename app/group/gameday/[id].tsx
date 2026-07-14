import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarPlus, ChevronLeft } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CreateEventModal } from '@/components/groups/create-event-modal';
import { EventCard } from '@/components/groups/event-card';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColors } from '@/contexts/theme-context';
import { errorMessage } from '@/lib/error-message';
import { fetchGroupEvents, type GroupEvent } from '@/lib/events';
import { fetchGroupDetail } from '@/lib/groups';

/**
 * Game Day: a group's event cards (RSVPs + post-game MVP votes), reached
 * from the group screen's action grid — same navigation pattern as the
 * Leaderboard screen. The group owner creates games via the header button.
 */
export default function GameDayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [events, setEvents] = useState<GroupEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id || !userId) return;
    try {
      const [detail, fetchedEvents] = await Promise.all([
        fetchGroupDetail(id, userId),
        fetchGroupEvents(id, userId),
      ]);
      if (!detail) {
        Alert.alert('Group not found', "This group doesn't exist or you're no longer a member.");
        router.back();
        return;
      }
      setEvents(fetchedEvents);
    } catch (e) {
      Alert.alert('Could not load games', errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id, userId, router]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={26} color={colors.text} strokeWidth={2} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Game Day</Text>
        <AnimatedPressable onPress={() => setCreateOpen(true)} hitSlop={8}>
          <CalendarPlus size={22} color={colors.text} strokeWidth={1.75} />
        </AnimatedPressable>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.text} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <AnimatedPressable style={styles.createButton} onPress={() => setCreateOpen(true)}>
            <CalendarPlus size={16} color={ON_ACCENT} strokeWidth={2.25} />
            <Text style={styles.createButtonText}>Create Game</Text>
          </AnimatedPressable>

          {events.length === 0 ? (
            <Text style={styles.empty}>No games on the calendar yet — be the one who makes it happen.</Text>
          ) : (
            events.map((event) => (
              <EventCard key={event.id} event={event} currentUserId={userId ?? ''} onChanged={load} />
            ))
          )}
        </ScrollView>
      )}

      {userId && id ? (
        <CreateEventModal
          visible={createOpen}
          groupId={id}
          userId={userId}
          onClose={() => setCreateOpen(false)}
          onCreated={load}
        />
      ) : null}
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 16, fontWeight: WEIGHT.bold, color: colors.text },
    list: { padding: 20, paddingTop: 14, paddingBottom: 48 },
    createButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.coral,
      borderRadius: RADII.md,
      paddingVertical: 12,
      marginBottom: 16,
    },
    createButtonText: { color: ON_ACCENT, fontWeight: WEIGHT.semibold, fontSize: 14 },
    empty: { marginTop: 24, textAlign: 'center', fontStyle: 'italic', color: colors.textSecondary, fontSize: 14 },
  });
}
