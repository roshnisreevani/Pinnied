import { useRouter } from 'expo-router';
import { ChevronLeft, Flame, Target } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
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

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Your clip</Text>
        <AnimatedPressable style={styles.videoPicker} onPress={handlePickVideo}>
          <Text style={styles.videoPickerText}>{videoUri ? 'Clip selected — tap to change' : 'Record or choose a ~15s clip'}</Text>
        </AnimatedPressable>

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
    content: { padding: 20, paddingBottom: 60, gap: 8 },
    sectionTitle: { fontSize: 13, fontWeight: WEIGHT.bold, color: colors.text, marginTop: 16 },
    videoPicker: {
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: RADII.lg,
      padding: 20,
      alignItems: 'center',
    },
    videoPickerText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
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
    modeLabel: { fontSize: 14, fontWeight: WEIGHT.semibold, color: colors.text },
    modeLabelSelected: { color: colors.text },
    modeHint: { fontSize: 11, color: colors.textSecondary },
    pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    pill: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.pill,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    pillSelected: { backgroundColor: colors.coral, borderColor: colors.coral },
    pillText: { fontSize: 13, fontWeight: WEIGHT.semibold, color: colors.text },
    pillTextSelected: { color: ON_ACCENT },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
      backgroundColor: colors.background,
    },
    freeNote: { fontSize: 11, color: colors.textSecondary, marginTop: 14, textAlign: 'center' },
    submitButton: {
      backgroundColor: colors.coral,
      borderRadius: RADII.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 10,
    },
    submitButtonText: { color: ON_ACCENT, fontWeight: WEIGHT.semibold, fontSize: 15 },
  });
}
