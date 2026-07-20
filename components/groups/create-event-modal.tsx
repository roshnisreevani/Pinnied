import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import { errorMessage } from '@/lib/error-message';
import { createEvent, formatEventDate } from '@/lib/events';
import { SPORTS } from '@/lib/sports';

type Props = {
  visible: boolean;
  groupId: string;
  userId: string;
  onClose: () => void;
  onCreated: () => void;
};

const DEFAULT_LEAD_MS = 24 * 60 * 60 * 1000; // default to this time tomorrow

export function CreateEventModal({ visible, groupId, userId, onClose, onCreated }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [title, setTitle] = useState('');
  const [sport, setSport] = useState<string | null>(null);
  const [eventDate, setEventDate] = useState<Date>(() => new Date(Date.now() + DEFAULT_LEAD_MS));
  const [location, setLocation] = useState('');
  const [maxSpots, setMaxSpots] = useState('');
  const [saving, setSaving] = useState(false);
  // Android has no combined datetime mode — two sequential pickers instead.
  const [androidPicker, setAndroidPicker] = useState<'date' | 'time' | null>(null);

  const reset = () => {
    setTitle('');
    setSport(null);
    setEventDate(new Date(Date.now() + DEFAULT_LEAD_MS));
    setLocation('');
    setMaxSpots('');
  };

  const handleCreate = async () => {
    // Title is optional — fall back to something sensible from the sport.
    const sportLabel = SPORTS.find((s) => s.value === sport)?.label;
    const trimmedTitle = title.trim() || (sportLabel ? `${sportLabel} run` : 'Game day');
    const spots = maxSpots.trim() === '' ? null : Number.parseInt(maxSpots, 10);
    if (spots !== null && (!Number.isFinite(spots) || spots <= 0)) {
      Alert.alert('Invalid spots', 'Max spots must be a positive number, or blank for unlimited.');
      return;
    }

    setSaving(true);
    try {
      await createEvent({
        groupId,
        createdBy: userId,
        title: trimmedTitle,
        sport,
        eventDate,
        location: location.trim(),
        maxSpots: spots,
      });
      reset();
      onCreated();
      onClose();
    } catch (e) {
      Alert.alert('Could not create the game', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
            <Text style={styles.title}>New game</Text>

            <TextInput
              style={styles.input}
              placeholder="Title (optional) — e.g. Tuesday Night Run"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sportRow}>
              {SPORTS.map((s) => {
                const selected = sport === s.value;
                return (
                  <AnimatedPressable
                    key={s.value}
                    style={[styles.sportPill, selected && styles.sportPillSelected]}
                    onPress={() => setSport(selected ? null : s.value)}>
                    <Text style={[styles.sportPillText, selected && styles.sportPillTextSelected]}>
                      {s.emoji} {s.label}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </ScrollView>

            <Text style={styles.fieldLabel}>When</Text>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={eventDate}
                mode="datetime"
                onChange={(_e, selected) => selected && setEventDate(selected)}
              />
            ) : (
              <>
                <View style={styles.androidDateRow}>
                  <AnimatedPressable style={styles.androidDateButton} onPress={() => setAndroidPicker('date')}>
                    <Text style={styles.androidDateButtonText}>{formatEventDate(eventDate.toISOString())}</Text>
                  </AnimatedPressable>
                  <AnimatedPressable style={styles.androidDateButton} onPress={() => setAndroidPicker('time')}>
                    <Text style={styles.androidDateButtonText}>Set time</Text>
                  </AnimatedPressable>
                </View>
                {androidPicker ? (
                  <DateTimePicker
                    value={eventDate}
                    mode={androidPicker}
                    onChange={(_e, selected) => {
                      setAndroidPicker(null);
                      if (selected) setEventDate(selected);
                    }}
                  />
                ) : null}
              </>
            )}

            <TextInput
              style={styles.input}
              placeholder="Location — e.g. Riverside Courts"
              placeholderTextColor={colors.textSecondary}
              value={location}
              onChangeText={setLocation}
            />

            <TextInput
              style={styles.input}
              placeholder="Max spots (blank = unlimited)"
              placeholderTextColor={colors.textSecondary}
              value={maxSpots}
              onChangeText={setMaxSpots}
              keyboardType="number-pad"
            />

            <AnimatedPressable style={styles.createButton} onPress={handleCreate} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={ON_ACCENT} size="small" />
              ) : (
                <Text style={styles.createButtonText}>Create game</Text>
              )}
            </AnimatedPressable>
          </ScrollView>
        </Pressable>
      </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      alignSelf: 'stretch',
      maxHeight: '85%',
      backgroundColor: colors.background,
      borderRadius: RADII.lg,
    },
    content: { padding: 20, gap: 12 },
    title: { fontSize: 16, fontWeight: WEIGHT.bold, color: colors.text, textAlign: 'center', marginBottom: 2 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      paddingHorizontal: 13,
      paddingVertical: 11,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.background,
    },
    sportRow: { gap: 8 },
    sportPill: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.pill,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    sportPillSelected: { backgroundColor: colors.coral, borderColor: colors.coral },
    sportPillText: { fontSize: 12, fontWeight: WEIGHT.semibold, color: colors.text },
    sportPillTextSelected: { color: ON_ACCENT },
    fieldLabel: { fontSize: 12, fontWeight: WEIGHT.bold, color: colors.textSecondary },
    androidDateRow: { flexDirection: 'row', gap: 10 },
    androidDateButton: {
      flex: 1,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      paddingVertical: 10,
    },
    androidDateButtonText: { fontSize: 13, fontWeight: WEIGHT.semibold, color: colors.text },
    createButton: {
      marginTop: 6,
      backgroundColor: colors.coral,
      borderRadius: RADII.md,
      paddingVertical: 12,
      alignItems: 'center',
    },
    createButtonText: { color: ON_ACCENT, fontWeight: WEIGHT.semibold, fontSize: 14 },
  });
}
