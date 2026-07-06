import { Pause, Play } from 'lucide-react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { AnimatedPressable } from '@/components/ui/animated-pressable';
import { ON_ACCENT, RADII, WEIGHT, type ThemeColors } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import type { WalkupSong } from '@/lib/profile';

type Props = {
  song: WalkupSong;
};

export function WalkupSongPlayer({ song }: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const player = useAudioPlayer(song.previewUrl);
  const status = useAudioPlayerStatus(player);

  const progress = status.duration > 0 ? Math.min(status.currentTime / status.duration, 1) : 0;

  const toggle = () => {
    if (status.playing) {
      player.pause();
    } else {
      if (status.didJustFinish) {
        player.seekTo(0);
      }
      player.play();
    }
  };

  return (
    <View style={styles.row}>
      {song.artworkUrl ? (
        <Image source={{ uri: song.artworkUrl }} style={styles.artwork} />
      ) : (
        <View style={[styles.artwork, styles.artworkFallback]} />
      )}
      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.title}>
          {song.title}
        </Text>
        <Text numberOfLines={1} style={styles.artist}>
          {song.artist}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      </View>
      <AnimatedPressable style={styles.playButton} onPress={toggle}>
        {status.playing ? (
          <Pause size={16} color={ON_ACCENT} fill={ON_ACCENT} />
        ) : (
          <Play size={16} color={ON_ACCENT} fill={ON_ACCENT} />
        )}
      </AnimatedPressable>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    artwork: { width: 56, height: 56, borderRadius: RADII.md, backgroundColor: colors.borderSoft },
    artworkFallback: {},
    info: { flex: 1, gap: 5 },
    title: { fontWeight: WEIGHT.semibold, fontSize: 14, color: colors.text },
    artist: { color: colors.textSecondary, fontSize: 13 },
    progressTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.borderSoft,
      overflow: 'hidden',
    },
    progressFill: { height: '100%', backgroundColor: colors.coral },
    playButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.coral,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
