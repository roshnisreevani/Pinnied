import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Calendar } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { GameMap } from '@/components/open-games/game-map';
import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import { errorMessage } from '@/lib/error-message';
import { formatEventDate } from '@/lib/events';
import { searchPlaces, type PlaceResult } from '@/lib/geocoding';
import { SKILL_LEVEL_LABELS, type SkillLevel } from '@/lib/open-games';
import { SPORTS } from '@/lib/sports';

const SKILL_LEVELS: SkillLevel[] = ['all', 'beginner', 'competitive'];

function defaultStartTime(): Date {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0);
  return d;
}

export type OpenGameFormValues = {
  sport: string;
  title: string;
  description: string;
  skillLevel: SkillLevel;
  locationName: string;
  latitude: number;
  longitude: number;
  startsAt: string;
  maxSpots: number | null;
  requiresApproval: boolean;
  photosPublic: boolean;
};

type Props = {
  mode: 'create' | 'edit';
  initialValues?: Partial<OpenGameFormValues>;
  onSubmit: (values: OpenGameFormValues) => Promise<void>;
};

export function OpenGameForm({ mode, initialValues, onSubmit }: Props) {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [sport, setSport] = useState(initialValues?.sport ?? '');
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [skillLevel, setSkillLevel] = useState<SkillLevel>(initialValues?.skillLevel ?? 'all');
  const [locationName, setLocationName] = useState(initialValues?.locationName ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    initialValues?.latitude !== undefined && initialValues?.longitude !== undefined
      ? { lat: initialValues.latitude, lng: initialValues.longitude }
      : null
  );
  const [gettingLocation, setGettingLocation] = useState(false);
  const [maxSpots, setMaxSpots] = useState(initialValues?.maxSpots ? String(initialValues.maxSpots) : '');
  const [startsAt, setStartsAt] = useState<Date>(
    initialValues?.startsAt ? new Date(initialValues.startsAt) : defaultStartTime()
  );
  const [androidPicker, setAndroidPicker] = useState<'date' | 'time' | null>(null);
  const [requiresApproval, setRequiresApproval] = useState(initialValues?.requiresApproval ?? false);
  const [photosPublic, setPhotosPublic] = useState(initialValues?.photosPublic ?? false);
  const [saving, setSaving] = useState(false);

  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [searchingPlaces, setSearchingPlaces] = useState(false);
  const suppressNextSearch = useRef(false);

  // Debounced place search as the user types — suppressed for one keystroke
  // right after picking a suggestion, so selecting a result doesn't
  // immediately re-search for its own name and reopen the dropdown.
  useEffect(() => {
    if (suppressNextSearch.current) {
      suppressNextSearch.current = false;
      setPlaceResults([]);
      return;
    }
    if (locationName.trim().length < 3) {
      setPlaceResults([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearchingPlaces(true);
      try {
        const results = await searchPlaces(locationName);
        setPlaceResults(results);
      } catch {
        // Silent — place search is a convenience on top of typing/using
        // current location, not something that should block the form.
        setPlaceResults([]);
      } finally {
        setSearchingPlaces(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [locationName]);

  const handleSelectPlace = (place: PlaceResult) => {
    suppressNextSearch.current = true;
    setLocationName(place.name);
    setCoords({ lat: place.latitude, lng: place.longitude });
    setPlaceResults([]);
  };

  const applyCoordsAndReverseGeocode = async (lat: number, lng: number) => {
    setCoords({ lat, lng });
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (place) {
        const parts = [place.name, place.street, place.city].filter(Boolean);
        const guess = parts.slice(0, 2).join(', ');
        if (guess) {
          suppressNextSearch.current = true;
          setLocationName(guess);
        }
      }
    } catch {
      // Reverse geocoding is a convenience, not a requirement — if it fails
      // (offline, no result, etc.) the user can still type the location by
      // hand, so this is deliberately silent.
    }
  };

  const handleUseCurrentLocation = async () => {
    setGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location access needed', 'Turn on location access in Settings to set where this game is.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      await applyCoordsAndReverseGeocode(position.coords.latitude, position.coords.longitude);
    } catch (e) {
      Alert.alert('Could not get location', errorMessage(e));
    } finally {
      setGettingLocation(false);
    }
  };

  const handleMapMove = (next: { latitude: number; longitude: number }) => {
    applyCoordsAndReverseGeocode(next.latitude, next.longitude);
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    const trimmedLocation = locationName.trim();
    if (!sport) {
      Alert.alert('Pick a sport', 'Choose what sport this game is for.');
      return;
    }
    if (!trimmedTitle) {
      Alert.alert('Name required', 'Give your game a title.');
      return;
    }
    if (!trimmedLocation || !coords) {
      Alert.alert('Location required', 'Enter where it is, or tap the map to drop a pin.');
      return;
    }
    if (startsAt.getTime() < Date.now()) {
      Alert.alert('Pick a future time', "This game's start time is in the past.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        sport,
        title: trimmedTitle,
        description: description.trim(),
        skillLevel,
        locationName: trimmedLocation,
        latitude: coords.lat,
        longitude: coords.lng,
        startsAt: startsAt.toISOString(),
        maxSpots: maxSpots.trim() ? parseInt(maxSpots.trim(), 10) : null,
        requiresApproval,
        photosPublic,
      });
    } catch (e) {
      Alert.alert(mode === 'create' ? 'Could not post game' : 'Could not save changes', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <AnimatedPressable onPress={() => router.back()} hitSlop={8} disabled={saving}>
          <Text style={styles.cancelText}>Cancel</Text>
        </AnimatedPressable>
        <Text style={styles.headerTitle}>{mode === 'create' ? 'Post Open Game' : 'Edit Game'}</Text>
        <AnimatedPressable style={styles.saveButton} onPress={handleSubmit} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={ON_ACCENT} size="small" />
          ) : (
            <Text style={styles.saveButtonText}>{mode === 'create' ? 'Post' : 'Save'}</Text>
          )}
        </AnimatedPressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Section title="Sport" styles={styles}>
            <View style={styles.pillRow}>
              {SPORTS.slice(0, 12).map((s) => {
                const selected = s.value === sport;
                return (
                  <AnimatedPressable
                    key={s.value}
                    style={[styles.pill, selected && styles.pillSelected]}
                    onPress={() => setSport(s.value)}>
                    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                      {s.emoji} {s.label}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </Section>

          <Section title="Title" styles={styles}>
            <TextInput
              style={styles.input}
              placeholder="Sunday pickup run"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
          </Section>

          <Section title="Details (optional)" styles={styles}>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Bring your own ball, we'll do full court"
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </Section>

          <Section title="Skill level" styles={styles}>
            <View style={styles.pillRow}>
              {SKILL_LEVELS.map((level) => {
                const selected = level === skillLevel;
                return (
                  <AnimatedPressable
                    key={level}
                    style={[styles.pill, selected && styles.pillSelected]}
                    onPress={() => setSkillLevel(level)}>
                    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                      {SKILL_LEVEL_LABELS[level]}
                    </Text>
                  </AnimatedPressable>
                );
              })}
            </View>
          </Section>

          <Section title="When" styles={styles}>
            {Platform.OS === 'ios' ? (
              <DateTimePicker
                value={startsAt}
                mode="datetime"
                minimumDate={new Date()}
                onChange={(_e, selected) => selected && setStartsAt(selected)}
              />
            ) : (
              <>
                <View style={styles.androidDateRow}>
                  <AnimatedPressable style={styles.androidDateButton} onPress={() => setAndroidPicker('date')}>
                    <Calendar size={15} color={colors.text} strokeWidth={2} />
                    <Text style={styles.androidDateButtonText}>{formatEventDate(startsAt.toISOString())}</Text>
                  </AnimatedPressable>
                  <AnimatedPressable style={styles.androidDateButton} onPress={() => setAndroidPicker('time')}>
                    <Text style={styles.androidDateButtonText}>Change</Text>
                  </AnimatedPressable>
                </View>
                {androidPicker ? (
                  <DateTimePicker
                    value={startsAt}
                    mode={androidPicker}
                    minimumDate={new Date()}
                    onChange={(_e, selected) => {
                      setAndroidPicker(null);
                      if (selected) setStartsAt(selected);
                    }}
                  />
                ) : null}
              </>
            )}
          </Section>

          <Section title="Location" styles={styles}>
            <View>
              <TextInput
                style={styles.input}
                placeholder="Try a place name, like Adler Planetarium"
                placeholderTextColor={colors.textSecondary}
                value={locationName}
                onChangeText={setLocationName}
              />
              {searchingPlaces ? (
                <ActivityIndicator style={styles.searchSpinner} color={colors.textSecondary} size="small" />
              ) : null}
              {placeResults.length > 0 ? (
                <View style={styles.placeDropdown}>
                  {placeResults.map((place, i) => (
                    <AnimatedPressable
                      key={`${place.latitude}-${place.longitude}`}
                      style={[styles.placeRow, i === placeResults.length - 1 && styles.placeRowLast]}
                      onPress={() => handleSelectPlace(place)}>
                      <Text style={styles.placeRowText} numberOfLines={2}>
                        {place.name}
                      </Text>
                    </AnimatedPressable>
                  ))}
                </View>
              ) : null}
            </View>
            <AnimatedPressable
              style={styles.locationButton}
              onPress={handleUseCurrentLocation}
              disabled={gettingLocation}>
              {gettingLocation ? (
                <ActivityIndicator color={colors.text} size="small" />
              ) : (
                <Text style={styles.locationButtonText}>Use my current location</Text>
              )}
            </AnimatedPressable>
            {coords ? (
              <View style={styles.mapWrap}>
                <GameMap latitude={coords.lat} longitude={coords.lng} interactive onLocationChange={handleMapMove} />
                <Text style={styles.mapHint}>Tap or drag the pin to fine-tune the exact spot.</Text>
              </View>
            ) : null}
          </Section>

          <Section title="Max spots (optional)" styles={styles}>
            <TextInput
              style={styles.input}
              placeholder="e.g. 10"
              placeholderTextColor={colors.textSecondary}
              value={maxSpots}
              onChangeText={setMaxSpots}
              keyboardType="number-pad"
            />
          </Section>

          <Section title="Join requests" styles={styles}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>Require approval</Text>
                <Text style={styles.toggleHint}>
                  {requiresApproval
                    ? "People send a request with a short note — you approve or decline each one."
                    : 'Anyone eligible can join instantly, no approval needed.'}
                </Text>
              </View>
              <Switch
                value={requiresApproval}
                onValueChange={setRequiresApproval}
                trackColor={{ true: colors.coral, false: colors.border }}
                thumbColor={ON_ACCENT}
              />
            </View>
          </Section>

          <Section title="Photos" styles={styles}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleText}>
                <Text style={styles.toggleLabel}>Make photos public</Text>
                <Text style={styles.toggleHint}>
                  {photosPublic
                    ? 'Anyone browsing Discover can see photos from this game, even if they never joined.'
                    : 'Only people who joined this game can see its photos.'}
                </Text>
              </View>
              <Switch
                value={photosPublic}
                onValueChange={setPhotosPublic}
                trackColor={{ true: colors.coral, false: colors.border }}
                thumbColor={ON_ACCENT}
              />
            </View>
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Section({
  title,
  children,
  styles,
}: {
  title: string;
  children: React.ReactNode;
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cancelText: { fontSize: 15, color: colors.textSecondary },
    headerTitle: { fontSize: 16, fontWeight: WEIGHT.bold, color: colors.text },
    saveButton: {
      backgroundColor: colors.coral,
      borderRadius: RADII.pill,
      paddingHorizontal: 16,
      paddingVertical: 7,
      minWidth: 56,
      alignItems: 'center',
    },
    saveButtonText: { fontWeight: WEIGHT.bold, color: ON_ACCENT, fontSize: 14 },
    content: { padding: 20, paddingBottom: 60, gap: 4 },
    section: { marginTop: 20, gap: 8 },
    sectionTitle: { fontSize: 13, fontWeight: WEIGHT.bold, color: colors.text },
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
    multilineInput: { minHeight: 70, textAlignVertical: 'top' },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    toggleText: { flex: 1, gap: 2 },
    toggleLabel: { fontSize: 14, fontWeight: WEIGHT.semibold, color: colors.text },
    toggleHint: { fontSize: 12, color: colors.textSecondary, lineHeight: 16 },
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
    locationButton: {
      alignSelf: 'flex-start',
      marginTop: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.pill,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    locationButtonText: { fontSize: 13, fontWeight: WEIGHT.semibold, color: colors.text },
    searchSpinner: { position: 'absolute', right: 14, top: 14 },
    placeDropdown: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      marginTop: 6,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    placeRow: {
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderSoft,
    },
    placeRowLast: { borderBottomWidth: 0 },
    placeRowText: { fontSize: 13, color: colors.text },
    mapWrap: { marginTop: 12, gap: 6 },
    mapHint: { fontSize: 12, color: colors.textSecondary },
    androidDateRow: { flexDirection: 'row', gap: 8 },
    androidDateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADII.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    androidDateButtonText: { fontSize: 14, fontWeight: WEIGHT.medium, color: colors.text },
  });
}
