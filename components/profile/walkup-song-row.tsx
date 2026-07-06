import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Pause, Play } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import type { WalkupSong } from '@/lib/profile';

const BAR_COUNT = 14;
const ART_SIZE = 40;

// Future enhancement — once group check-ins/RSVP exist, trigger this song
// snippet to play automatically when the user checks into a session, so it
// functions as an actual walk-up moment rather than a static profile item.

type Props = {
  song: WalkupSong;
};

export function WalkupSongRow({ song }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const player = useAudioPlayer(song.previewUrl);
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;

  const toggle = () => {
    if (playing) {
      player.pause();
    } else {
      if (status.didJustFinish) player.seekTo(0);
      player.play();
    }
  };

  return (
    <View style={styles.row}>
      <SpinningArt uri={song.artworkUrl} playing={playing} colors={colors} />

      <Text numberOfLines={1} style={styles.title}>
        {song.title} <Text style={styles.dot}>·</Text> <Text style={styles.artist}>{song.artist}</Text>
      </Text>

      <Waveform playing={playing} colors={colors} />

      <PulsingPlayButton playing={playing} onPress={toggle} colors={colors} />
    </View>
  );
}

function SpinningArt({ uri, playing, colors }: { uri: string | null; playing: boolean; colors: ThemeColors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (playing) {
      rotation.value = withRepeat(
        withTiming(rotation.value + 360, { duration: 4000, easing: Easing.linear }),
        -1
      );
    } else {
      cancelAnimation(rotation);
    }
  }, [playing, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.artWrap, animatedStyle]}>
      {uri ? (
        <Image source={{ uri }} style={styles.artImage} />
      ) : (
        <View style={[styles.artImage, styles.artFallback]} />
      )}
      <View style={styles.artHole} />
    </Animated.View>
  );
}

function Waveform({ playing, colors }: { playing: boolean; colors: ThemeColors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.waveform}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <Bar key={i} index={i} playing={playing} colors={colors} />
      ))}
    </View>
  );
}

const BAR_MIN = 4;
const BAR_MAX = 16;

function Bar({ index, playing, colors }: { index: number; playing: boolean; colors: ThemeColors }) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const height = useSharedValue(BAR_MIN);

  useEffect(() => {
    if (playing) {
      const factors = [0.3, 0.9, 0.5, 1, 0.35, 0.75];
      const targets = factors.map((f) => BAR_MIN + f * (BAR_MAX - BAR_MIN));
      const duration = 260 + (index % 3) * 60;

      height.value = withDelay(
        index * 40,
        withRepeat(withSequence(...targets.map((t) => withTiming(t, { duration }))), -1, true)
      );
    } else {
      cancelAnimation(height);
      height.value = withTiming(BAR_MIN, { duration: 200 });
    }
  }, [playing, index, height]);

  const animatedStyle = useAnimatedStyle(() => ({ height: height.value }));

  return <Animated.View style={[styles.bar, animatedStyle]} />;
}

function PulsingPlayButton({
  playing,
  onPress,
  colors,
}: {
  playing: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  useEffect(() => {
    if (playing) {
      glowOpacity.value = withRepeat(
        withSequence(withTiming(0.35, { duration: 700 }), withTiming(0, { duration: 700 })),
        -1,
        false
      );
      glowScale.value = withRepeat(
        withSequence(withTiming(1.4, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1,
        false
      );
    } else {
      cancelAnimation(glowOpacity);
      cancelAnimation(glowScale);
      glowOpacity.value = withTiming(0, { duration: 150 });
      glowScale.value = withTiming(1, { duration: 150 });
    }
  }, [playing, glowOpacity, glowScale]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  return (
    <View style={styles.playWrap}>
      <Animated.View style={[styles.glow, glowStyle]} />
      <AnimatedPressable style={styles.playButton} onPress={onPress}>
        {playing ? (
          <Pause size={14} color={ON_ACCENT} fill={ON_ACCENT} />
        ) : (
          <Play size={14} color={ON_ACCENT} fill={ON_ACCENT} />
        )}
      </AnimatedPressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { flex: 1, fontSize: 12, color: colors.text, fontWeight: '600' },
    dot: { color: colors.textSecondary },
    artist: { color: colors.textSecondary, fontWeight: '400' },
    artWrap: {
      width: ART_SIZE,
      height: ART_SIZE,
      borderRadius: ART_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    artImage: { width: ART_SIZE, height: ART_SIZE, borderRadius: ART_SIZE / 2 },
    artFallback: { backgroundColor: colors.borderSoft },
    artHole: {
      position: 'absolute',
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    waveform: { flexDirection: 'row', alignItems: 'center', gap: 2, height: BAR_MAX, width: 60 },
    bar: { width: 2.5, borderRadius: 1.5, backgroundColor: colors.coral },
    playWrap: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    glow: {
      position: 'absolute',
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.coral,
    },
    playButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.coral,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
