import { useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ChevronLeft, Flame, Pencil, Target, Video } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, SPACING, TYPE, WEIGHT, type ThemeColors } from '@/constants/style';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColors } from '@/contexts/theme-context';
import { errorMessage } from '@/lib/error-message';
import { createHighlightClip, type HighlightMode } from '@/lib/highlights';
import type { SkillLevel } from '@/lib/open-games';
import { pickVideoClip } from '@/lib/pick-photo';

const SELF_SKILL_LABELS: Record<SkillLevel, string> = {
  beginner: 'Beginner',
  all: 'Somewhere in between',
  competitive: 'Competitive',
};

/**
 * Shows the actual picked clip, paused on its first frame, as a real
 * thumbnail instead of a generic "clip selected" text box — same
 * expo-video player/VideoView pairing PostVideo uses for feed clips.
 */
function VideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.pause();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

export default function CreateHighlightScreen() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [mode, setMode] = useState<HighlightMode>('roast');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>('all');
  const [sport, setSport] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handlePickVideo = async () => {
    const uri = await pickVideoClip();
    if (uri) setVideoUri(uri);
  };

  const handleSubmit = async () => {
    if (!userId) return;
    if (!videoUri) {
      Alert.alert('Add a clip first', 'Record or choose a short video to continue.');
      return;
    }
    setSubmitting(true);
    try {
      const clipId = await createHighlightClip({
        userId,
        localVideoUri: videoUri,
        mode,
        sport: sport.trim() || null,
        skillLevel: mode === 'critique' ? skillLevel : null,
      });
      router.replace(`/highlight/${clipId}`);
    } catch (e) {
      Alert.alert('Could not create highlight', errorMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => router.back()} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </AnimatedPressable>
        <Text style={styles.headerTitle}>New highlight</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>Your clip</Text>
        {videoUri ? (
          <AnimatedPressable style={styles.videoThumb} onPress={handlePickVideo}>
            <VideoThumb uri={videoUri} />
            <View style={styles.videoThumbLabel}>
              <Text style={styles.videoThumbLabelText}>Clip selected</Text>
            </View>
            <View style={styles.videoThumbEditBadge}>
              <Pencil size={12} color="#FFFFFF" strokeWidth={2} />
            </View>
          </AnimatedPressable>
        ) : (
          <AnimatedPressable style={styles.videoPicker} onPress={handlePickVideo}>
            <View style={styles.videoPickerIconWrap}>
              <Video size={18} color={colors.coral} strokeWidth={2} />
            </View>
            <Text style={styles.videoPickerText}>Record or choose a ~15s clip</Text>
          </AnimatedPressable>
        )}

        <Text style={styles.sectionTitle}>Mode</Text>
        <View style={styles.modeRow}>
          <AnimatedPressable
            style={[styles.modeCard, mode === 'roast' && styles.modeCardSelected]}
            onPress={() => setMode('roast')}>
            <Flame size={18} color={mode === 'roast' ? colors.coral : colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.modeLabel, mode === 'roast' && styles.modeLabelSelected]}>Roast</Text>
            <Text style={styles.modeHint}>Funny, no mercy</Text>
          </AnimatedPressable>
          <AnimatedPressable
            style={[styles.modeCard, mode === 'critique' && styles.modeCardSelected]}
            onPress={() => setMode('critique')}>
            <Target size={18} color={mode === 'critique' ? colors.blue : colors.textSecondary} strokeWidth={2} />
            <Text style={[styles.modeLabel, mode === 'critique' && styles.modeLabelSelected]}>Critique me</Text>
            <Text style={styles.modeHint}>Real notes, your level</Text>
          </AnimatedPressable>
        </View>

        {mode === 'critique' ? (
          <>
            <Text style={styles.sectionTitle}>Your level</Text>
            <View style={styles.pillRow}>
              {(Object.keys(SELF_SKILL_LABELS) as SkillLevel[]).map((level) => (
                <AnimatedPressable
                  key={level}
                  style={[styles.pill, skillLevel === level && styles.pillSelected]}
                  onPress={() => setSkillLevel(level)}>
                  <Text style={[styles.pillText, skillLevel === level && styles.pillTextSelected]}>
                    {SELF_SKILL_LABELS[level]}
                  </Text>
                </AnimatedPressable>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Sport (optional)</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. basketball — leave blank and we'll guess"
          placeholderTextColor={colors.textSecondary}
          value={sport}
          onChangeText={setSport}
        />

        <Text style={styles.freeNote}>2 free clips a day.</Text>

        <AnimatedPressable style={styles.submitButton} onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={ON_ACCENT} size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Generate</Text>
          )}
        </AnimatedPressable>
      </ScrollView>
      </KeyboardAvoidingView>
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
    headerTitle: { fontSize: TYPE.subtitle, fontWeight: WEIGHT.bold, color: colors.text },
    content: { padding: SPACING.xl, paddingBottom: 60, gap: 8 },
    sectionTitle: { fontSize: TYPE.label, fontWeight: WEIGHT.bold, color: colors.text, marginTop: SPACING.lg },
    videoPicker: {
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: RADII.lg,
      padding: 20,
      alignItems: 'center',
      gap: 8,
    },
    videoPickerIconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.coral + '18',
      alignItems: 'center',
      justifyContent: 'center',
    },
    videoPickerText: { fontSize: TYPE.label, color: colors.textSecondary, textAlign: 'center' },
    videoThumb: {
      height: 130,
      borderRadius: RADII.lg,
      overflow: 'hidden',
      backgroundColor: '#000000',
    },
    videoThumbLabel: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: RADII.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    videoThumbLabelText: { fontSize: TYPE.caption, color: '#FFFFFF', fontWeight: WEIGHT.semibold },
    videoThumbEditBadge: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeRow: { flexDirection: 'row', gap: 8 },
    modeCard: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      padding: 12,
      gap: 3,
    },
    modeCardSelected: { borderColor: colors.text, borderWidth: 1.5 },
    modeLabel: { fontSize: TYPE.body, fontWeight: WEIGHT.semibold, color: colors.text },
    modeLabelSelected: { color: colors.text },
    modeHint: { fontSize: TYPE.caption, color: colors.textSecondary },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.pill,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    pillSelected: { backgroundColor: colors.coral, borderColor: colors.coral },
    pillText: { fontSize: TYPE.label, fontWeight: WEIGHT.semibold, color: colors.text },
    pillTextSelected: { color: ON_ACCENT },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: TYPE.body,
      color: colors.text,
      backgroundColor: colors.background,
    },
    freeNote: { fontSize: TYPE.caption, color: colors.textSecondary, marginTop: SPACING.md, textAlign: 'center' },
    submitButton: {
      backgroundColor: colors.coral,
      borderRadius: RADII.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 10,
    },
    submitButtonText: { color: ON_ACCENT, fontWeight: WEIGHT.semibold, fontSize: TYPE.body },
  });
}
