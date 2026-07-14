import { Bookmark, Repeat, Users } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text } from 'react-native';

import { WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import { fetchMyGroups, type Group } from '@/lib/groups';
import { savePost, shareToGroup, type Post } from '@/lib/posts';

type Props = {
  visible: boolean;
  post: Post;
  currentUserId: string;
  onClose: () => void;
  // Feed/Group screens already have their own resharePost + refresh + toast
  // logic wired up from before this sheet existed — reused here rather than
  // duplicated, so there's exactly one place that does a reshare.
  onReshare: () => void;
};

type Step = 'menu' | 'groups';

/**
 * Tap the share icon on a post to get here — exactly three destinations:
 * reshare to your own Feed, share into one of your groups, or save it
 * privately (visible only to you, doesn't post anywhere). Both reshare paths
 * stamp reshared_from_* on the new post so it visibly credits the original
 * (see lib/posts.ts resharePost/shareToGroup).
 */
export function ShareSheet({ visible, post, currentUserId, onClose, onReshare }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState<Step>('menu');
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) {
      setStep('menu');
      setGroups(null);
    }
  }, [visible]);

  const close = () => {
    if (busy) return;
    onClose();
  };

  const handleReshare = () => {
    onClose();
    onReshare();
  };

  const openGroupPicker = async () => {
    setStep('groups');
    if (groups !== null) return;
    try {
      setGroups(await fetchMyGroups(currentUserId));
    } catch (e) {
      Alert.alert('Could not load your groups', e instanceof Error ? e.message : 'Unknown error.');
      setGroups([]);
    }
  };

  const handleShareToGroup = async (group: Group) => {
    setBusy(true);
    try {
      await shareToGroup(post, group.id, currentUserId);
      onClose();
      Alert.alert('Shared', `Posted to ${group.name}.`);
    } catch (e) {
      Alert.alert('Could not share', e instanceof Error ? e.message : 'Unknown error.');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await savePost(currentUserId, post.id);
      onClose();
      Alert.alert('Saved', 'Added to your saved posts.');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {step === 'menu' ? (
            <>
              <Text style={styles.title}>Share this post</Text>
              <ShareRow
                icon={<Repeat size={18} color={colors.text} strokeWidth={2} />}
                label="Reshare to your Feed"
                onPress={handleReshare}
                disabled={busy}
                styles={styles}
              />
              <ShareRow
                icon={<Users size={18} color={colors.text} strokeWidth={2} />}
                label="Share to a group"
                onPress={openGroupPicker}
                disabled={busy}
                styles={styles}
              />
              <ShareRow
                icon={<Bookmark size={18} color={colors.text} strokeWidth={2} />}
                label="Save"
                onPress={handleSave}
                disabled={busy}
                styles={styles}
              />
            </>
          ) : (
            <>
              <Text style={styles.title}>Share to which group?</Text>
              {groups === null ? (
                <ActivityIndicator color={colors.text} style={styles.loading} />
              ) : groups.length === 0 ? (
                <Text style={styles.empty}>You're not in any groups yet.</Text>
              ) : (
                groups.map((group) => (
                  <ShareRow
                    key={group.id}
                    icon={<Users size={18} color={colors.text} strokeWidth={2} />}
                    label={group.name}
                    onPress={() => handleShareToGroup(group)}
                    disabled={busy}
                    styles={styles}
                  />
                ))
              )}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ShareRow({
  icon,
  label,
  onPress,
  disabled,
  styles,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} disabled={disabled} hitSlop={4}>
      {icon}
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 30,
    },
    card: {
      width: '100%',
      maxWidth: 320,
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 18,
      gap: 4,
    },
    title: { fontSize: 14, fontWeight: WEIGHT.semibold, color: colors.textSecondary, marginBottom: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
    rowLabel: { fontSize: 15, color: colors.text, fontWeight: WEIGHT.medium, flexShrink: 1 },
    loading: { marginVertical: 10 },
    empty: { fontSize: 13, color: colors.textSecondary, paddingVertical: 10 },
  });
}
