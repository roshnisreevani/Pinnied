import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Bell, Flame, MapPin, Settings, UserPlus, Users } from 'lucide-react-native';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PickThreeField } from '@/components/profile/pick-three-field';
import { PinnieIcon } from '@/components/profile/pinnie-icon';
import { ProfileAvatar } from '@/components/profile/profile-avatar';
import { QrShareModal } from '@/components/profile/qr-share-modal';
import { SportTagsField } from '@/components/profile/sport-tags-field';
import { TrophyCase } from '@/components/profile/trophy-case';
import { WalkupSongRow } from '@/components/profile/walkup-song-row';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColors } from '@/contexts/theme-context';
import { fetchReceivedRequestsCount } from '@/lib/connections';
import { fetchFollowCounts } from '@/lib/follows';
import { fetchMyGroupsCount } from '@/lib/groups';
import { MOCK_STREAK_WEEKS } from '@/lib/mock-stats';
import { fetchUnreadNotificationCount } from '@/lib/notifications';
import { emptyProfile, fetchProfile, saveProfile, type Profile, type Trophy } from '@/lib/profile';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function ProfileScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [groupsCount, setGroupsCount] = useState(0);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const fetched = await fetchProfile(userId);
      setProfile(fetched);
    } catch (e) {
      Alert.alert('Could not load your profile', e instanceof Error ? e.message : 'Unknown error.');
      setProfile(emptyProfile(userId));
    } finally {
      setLoading(false);
    }

    // Both of these drive small badges on the top-row icons — non-fatal:
    // the badges just stay at their last known value if either fails.
    try {
      setPendingRequestsCount(await fetchReceivedRequestsCount(userId));
    } catch {
      // Non-critical.
    }
    try {
      setUnreadNotificationsCount(await fetchUnreadNotificationCount(userId));
    } catch {
      // Non-critical.
    }
    // Stat-row counts — same non-fatal treatment as the badges above.
    try {
      setFollowCounts(await fetchFollowCounts(userId));
    } catch {
      // Non-critical.
    }
    try {
      setGroupsCount(await fetchMyGroupsCount(userId));
    } catch {
      // Non-critical.
    }
  }, [userId]);

  // Reload every time this tab gains focus, so edits made on the Edit Profile
  // screen show up immediately when the user comes back.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Exactly one trophy can be "legendary" at a time — marking a new one
  // automatically clears the flag from whichever trophy had it before.
  const withLegendaryEnforced = (trophies: Trophy[], legendaryId: string | null): Trophy[] =>
    trophies.map((t) => ({ ...t, legendary: legendaryId !== null && t.id === legendaryId }));

  const handleAddTrophy = async (trophy: Omit<Trophy, 'id'>) => {
    if (!profile) return;
    const id = generateId();
    const added: Trophy = { ...trophy, id };
    const nextTrophies = trophy.legendary
      ? withLegendaryEnforced([...profile.trophies, added], id)
      : [...profile.trophies, added];
    const next: Profile = { ...profile, trophies: nextTrophies };
    setProfile(next);
    try {
      await saveProfile(next);
    } catch (e) {
      setProfile(profile);
      Alert.alert('Could not add trophy', e instanceof Error ? e.message : 'Unknown error.');
    }
  };

  const handleUpdateTrophy = async (trophy: Trophy) => {
    if (!profile) return;
    const merged = profile.trophies.map((t) => (t.id === trophy.id ? trophy : t));
    const nextTrophies = trophy.legendary ? withLegendaryEnforced(merged, trophy.id) : merged;
    const next: Profile = { ...profile, trophies: nextTrophies };
    setProfile(next);
    try {
      await saveProfile(next);
    } catch (e) {
      setProfile(profile);
      Alert.alert('Could not update trophy', e instanceof Error ? e.message : 'Unknown error.');
    }
  };

  const handleRemoveTrophy = async (id: string) => {
    if (!profile) return;
    const next: Profile = { ...profile, trophies: profile.trophies.filter((t) => t.id !== id) };
    setProfile(next);
    try {
      await saveProfile(next);
    } catch (e) {
      setProfile(profile);
      Alert.alert('Could not remove trophy', e instanceof Error ? e.message : 'Unknown error.');
    }
  };

  const handleShare = () => {
    setShareOpen(true);
  };

  if (loading || !profile) {
    return (
      <SafeAreaView style={styles.loading} edges={['top']}>
        <ActivityIndicator color={colors.text} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Top row: name + settings/bell icons */}
        <View style={styles.topRow}>
          <Text style={styles.topName} numberOfLines={1}>
            {profile.name || 'Nameless legend'}
          </Text>
          <View style={styles.topIcons}>
            <AnimatedPressable hitSlop={8} onPress={() => router.push('/requests')} style={styles.iconWrap}>
              <UserPlus size={22} color={colors.text} strokeWidth={1.75} />
              {pendingRequestsCount > 0 ? (
                <IconBadge count={pendingRequestsCount} color={colors.blue} styles={styles} />
              ) : null}
            </AnimatedPressable>
            <AnimatedPressable hitSlop={8} onPress={() => router.push('/notifications')} style={styles.iconWrap}>
              <Bell size={22} color={colors.text} strokeWidth={1.75} />
              {unreadNotificationsCount > 0 ? (
                <IconBadge count={unreadNotificationsCount} color={colors.coral} styles={styles} />
              ) : null}
            </AnimatedPressable>
            <AnimatedPressable hitSlop={8} onPress={() => router.push('/settings')}>
              <Settings size={22} color={colors.text} strokeWidth={1.75} />
            </AnimatedPressable>
          </View>
        </View>

        {/* Streak counter — mock until real attendance tracking exists */}
        <View style={styles.streakPill}>
          <Flame size={14} color={colors.coral} strokeWidth={2} fill={colors.coral} />
          <Text style={styles.streakText}>{MOCK_STREAK_WEEKS}-week streak</Text>
        </View>

        {/* Walk-up song — compact row right under the name/streak; renders
            nothing at all (no placeholder, no spacing) when unset */}
        {profile.walkupSong ? (
          <View style={styles.songRowWrap}>
            <WalkupSongRow song={profile.walkupSong} />
          </View>
        ) : null}

        {/* Profile block: avatar left, location/bio/sports right, stat row under */}
        <View style={styles.profileCard}>
          <View style={styles.profileCardTop}>
            <ProfileAvatar name={profile.name} photoUri={profile.avatarUrl} size={96} />
            <View style={styles.profileCardInfo}>
              <View style={styles.locationRow}>
                <MapPin size={14} color={colors.textSecondary} strokeWidth={1.75} />
                <Text style={styles.location} numberOfLines={2}>
                  {profile.location || 'Location unknown (probably local)'}
                </Text>
              </View>
              <Text style={[styles.bio, !profile.legend && styles.placeholderText]}>
                {profile.legend || 'peaked in 8th grade, still showing up'}
              </Text>
              <SportTagsField editing={false} selected={profile.sportTags} />
            </View>
          </View>

          <View style={styles.statRow}>
            <StatItem
              icon={<PinnieIcon size={17} color={colors.blue} />}
              value={followCounts.followers}
              label="Followers"
              onPress={() => router.push('/follows?tab=followers')}
              styles={styles}
            />
            <View style={styles.statDivider} />
            <StatItem
              icon={<PinnieIcon size={17} color={colors.coral} />}
              value={followCounts.following}
              label="Following"
              onPress={() => router.push('/follows?tab=following')}
              styles={styles}
            />
            <View style={styles.statDivider} />
            <StatItem
              icon={<Users size={17} color={colors.text} strokeWidth={1.75} />}
              value={groupsCount}
              label="Groups"
              styles={styles}
            />
          </View>
        </View>

        {/* Edit profile + Share */}
        <View style={styles.actionRow}>
          <AnimatedPressable style={styles.secondaryButton} onPress={() => router.push('/edit-profile')}>
            <Text style={styles.secondaryButtonText}>Edit profile</Text>
          </AnimatedPressable>
          <AnimatedPressable style={styles.primaryButton} onPress={handleShare}>
            <Text style={styles.primaryButtonText}>Share</Text>
          </AnimatedPressable>
        </View>

        {/* Pick Your 3 — now the sole primary section here since walk-up song moved up top */}
        <Section title="Pick Your 3" styles={styles}>
          <PickThreeField editing={false} items={profile.pickThree} />
        </Section>
      </ScrollView>

      {userId ? (
        <QrShareModal
          visible={shareOpen}
          onClose={() => setShareOpen(false)}
          userId={userId}
          name={profile.name}
        />
      ) : null}
    </SafeAreaView>
  );
}

// Small count badge for the top-row icons — deliberately given a distinct
// color per icon (blue for Connections/requests, coral for Notifications)
// so a pending connection request and unread post activity never look like
// the same kind of thing at a glance.
function IconBadge({ count, color, styles }: { count: number; color: string; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={[styles.iconBadge, { backgroundColor: color }]}>
      <Text style={styles.iconBadgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

function StatItem({
  icon,
  value,
  label,
  onPress,
  styles,
}: {
  icon: ReactNode;
  value: number;
  label: string;
  onPress?: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const content = (
    <>
      {icon}
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </>
  );
  if (!onPress) return <View style={styles.stat}>{content}</View>;
  return (
    <AnimatedPressable style={styles.stat} onPress={onPress} hitSlop={4}>
      {content}
    </AnimatedPressable>
  );
}

function Section({
  title,
  children,
  styles,
}: {
  title: string;
  children: ReactNode;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.background },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    content: { padding: 20, paddingBottom: 48, gap: 4 },
    iconWrap: { position: 'relative' },
    iconBadge: {
      position: 'absolute',
      top: -4,
      right: -6,
      minWidth: 15,
      height: 15,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
      borderWidth: 1.5,
      borderColor: colors.background,
    },
    iconBadgeText: { fontSize: 9, fontWeight: WEIGHT.bold, color: ON_ACCENT },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    topName: { fontSize: 20, fontWeight: WEIGHT.bold, color: colors.text, flex: 1 },
    topIcons: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    streakPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      marginTop: 10,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: RADII.pill,
      borderWidth: 1,
      borderColor: colors.border,
    },
    streakText: { fontSize: 12, fontWeight: WEIGHT.semibold, color: colors.text },
    songRowWrap: { marginTop: 14 },
    // Bare content block — no card surface/border, just the avatar+info row
    // and the stat row sitting directly on the page background.
    profileCard: {
      marginTop: 18,
      gap: 14,
    },
    profileCardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    profileCardInfo: { flex: 1, gap: 6 },
    locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    stat: { flex: 1, alignItems: 'center', gap: 2 },
    statDivider: { width: 1, backgroundColor: colors.border },
    statValue: { fontSize: 17, fontWeight: WEIGHT.bold, color: colors.text },
    statLabel: { fontSize: 11, color: colors.textSecondary },
    location: { flex: 1, fontSize: 13, color: colors.textSecondary },
    bio: { fontSize: 14, fontStyle: 'italic', fontWeight: WEIGHT.semibold, color: colors.text },
    placeholderText: { fontStyle: 'italic', color: colors.textSecondary },
    actionRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
    secondaryButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 11,
      borderRadius: RADII.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    secondaryButtonText: { fontWeight: WEIGHT.semibold, fontSize: 14, color: colors.text },
    primaryButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 11,
      borderRadius: RADII.md,
      backgroundColor: colors.coral,
    },
    primaryButtonText: { fontWeight: WEIGHT.semibold, fontSize: 14, color: ON_ACCENT },
    section: { marginTop: 26, gap: 10 },
    sectionTitle: { fontSize: 13, fontWeight: WEIGHT.bold, color: colors.text },
  });
}
