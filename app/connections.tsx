import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { InitialsAvatar } from '@/components/profile/initials-avatar';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColors } from '@/contexts/theme-context';
import { errorMessage } from '@/lib/error-message';
import { fetchFollowers, fetchFollowing, followUser, unfollowUser, type FollowUser } from '@/lib/follows';

type Tab = 'followed_you' | 'you_followed';

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ConnectionsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [tab, setTab] = useState<Tab>('followed_you');
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [fetchedFollowers, fetchedFollowing] = await Promise.all([
        fetchFollowers(userId),
        fetchFollowing(userId),
      ]);
      setFollowers(fetchedFollowers);
      setFollowing(fetchedFollowing);
    } catch (e) {
      Alert.alert('Could not load connections', errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Which of my followers I follow back — drives the per-row button state.
  const followingIds = useMemo(() => new Set(following.map((f) => f.id)), [following]);

  const handleToggleFollow = async (person: FollowUser) => {
    if (!userId || busyId) return;
    const iFollow = followingIds.has(person.id);
    setBusyId(person.id);
    try {
      if (iFollow) {
        await unfollowUser(userId, person.id);
      } else {
        await followUser(userId, person.id);
      }
      await load();
    } catch (e) {
      Alert.alert(iFollow ? 'Could not unfollow' : 'Could not follow', errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const data = tab === 'followed_you' ? followers : following;

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={26} color={colors.text} strokeWidth={2} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>Connections</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.tabRow}>
        {(['followed_you', 'you_followed'] as const).map((t) => {
          const selected = t === tab;
          const label =
            t === 'followed_you' ? `Followed you (${followers.length})` : `You followed (${following.length})`;
          return (
            <AnimatedPressable
              key={t}
              style={[styles.tabPill, selected && styles.tabPillSelected]}
              onPress={() => setTab(t)}>
              <Text style={[styles.tabPillText, selected && styles.tabPillTextSelected]}>{label}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.text} style={styles.spinner} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === 'followed_you'
                ? 'No one has followed you yet — share your profile to get on some radars.'
                : "You haven't followed anyone yet. Find people from the Feed's search."}
            </Text>
          }
          renderItem={({ item }) => {
            const iFollow = followingIds.has(item.id);
            return (
              <AnimatedPressable style={styles.row} onPress={() => router.push(`/user/${item.id}`)}>
                {item.avatarUrl ? (
                  <Image source={{ uri: item.avatarUrl }} style={styles.avatar} />
                ) : (
                  <InitialsAvatar name={item.name} size={40} />
                )}
                <View style={styles.rowText}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.rowTime}>{timeAgo(item.followedAt)}</Text>
                </View>
                {tab === 'followed_you' ? (
                  busyId === item.id ? (
                    <ActivityIndicator color={colors.text} size="small" />
                  ) : (
                    <AnimatedPressable
                      style={iFollow ? styles.followingButton : styles.followBackButton}
                      onPress={() => handleToggleFollow(item)}
                      hitSlop={6}>
                      <Text style={iFollow ? styles.followingButtonText : styles.followBackButtonText}>
                        {iFollow ? 'Following' : 'Follow back'}
                      </Text>
                    </AnimatedPressable>
                  )
                ) : null}
              </AnimatedPressable>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
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
    tabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 14 },
    tabPill: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.pill,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    tabPillSelected: { backgroundColor: colors.coral, borderColor: colors.coral },
    tabPillText: { fontSize: 13, fontWeight: WEIGHT.semibold, color: colors.text },
    tabPillTextSelected: { color: ON_ACCENT },
    spinner: { marginTop: 30 },
    list: { padding: 20, paddingTop: 12, flexGrow: 1 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
    avatar: { width: 40, height: 40, borderRadius: 20 },
    rowText: { flex: 1, gap: 1 },
    rowName: { fontSize: 14, fontWeight: WEIGHT.medium, color: colors.text },
    rowTime: { fontSize: 12, color: colors.textSecondary },
    followBackButton: {
      backgroundColor: colors.coral,
      borderRadius: RADII.pill,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    followBackButtonText: { fontSize: 12, fontWeight: WEIGHT.semibold, color: ON_ACCENT },
    followingButton: {
      borderWidth: 1,
      borderColor: colors.blue,
      borderRadius: RADII.pill,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    followingButtonText: { fontSize: 12, fontWeight: WEIGHT.semibold, color: colors.blue },
    empty: { marginTop: 40, textAlign: 'center', fontSize: 14, color: colors.textSecondary, paddingHorizontal: 12 },
  });
}
