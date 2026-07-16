import Svg, {
  ClipPath,
  Defs,
  G,
  Image as SvgImage,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { WEIGHT } from '@/constants/style';
import { useThemeColors } from '@/contexts/theme-context';
import { useCachedUri } from '@/lib/cached-image';

// Exact crest geometry (design-provided — do not redraw or re-scale). One
// shared path drawn three times: gradient frame at full size, white ring at
// 0.93, and the photo clip at 0.86, both scaled around the viewBox center.
const CREST_PATH =
  'M 40 66 Q 40 34 72 34 L 150 34 Q 176 34 186 54 Q 200 70 214 54 ' +
  'Q 224 34 250 34 L 328 34 Q 360 34 360 66 L 360 250 Q 360 312 262 348 ' +
  'Q 212 366 200 366 Q 188 366 138 348 Q 40 312 40 250 Z';

const RING_TRANSFORM = 'translate(200,200) scale(0.93) translate(-200,-200)';
const CLIP_TRANSFORM = 'translate(200,200) scale(0.86) translate(-200,-200)';

function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Props = {
  photoUri: string | null;
  name: string; // initials fallback when there's no photo
  size?: number; // rendered width and height (square viewBox)
};

/**
 * Crest-shaped profile photo: red→blue diagonal gradient frame, white inner
 * ring, photo clipped to the crest. Reusable for any user — pass the photo
 * URI (or null to show initials).
 */
export function CrestAvatar({ photoUri, name, size = 155 }: Props) {
  const colors = useThemeColors();
  // react-native-svg's <Image> has no HTTP cache of its own, so without this
  // every crest render re-downloads the full photo from Supabase Storage —
  // this is what was blowing through the project's cached-egress quota.
  const cachedPhotoUri = useCachedUri(photoUri);

  return (
    <Svg width={size} height={size} viewBox="0 0 400 400">
      <Defs>
        <LinearGradient id="crestFrame" x1="0" y1="0.15" x2="1" y2="0.85">
          <Stop offset="0" stopColor="#e23b2e" />
          <Stop offset="0.5" stopColor="#c33" />
          <Stop offset="1" stopColor="#2f6bff" />
        </LinearGradient>
        <ClipPath id="crestClip">
          <Path d={CREST_PATH} transform={CLIP_TRANSFORM} />
        </ClipPath>
      </Defs>

      {/* Gradient frame → white ring → photo window */}
      <Path d={CREST_PATH} fill="url(#crestFrame)" />
      <Path d={CREST_PATH} transform={RING_TRANSFORM} fill="#FFFFFF" />

      {photoUri ? (
        <G clipPath="url(#crestClip)">
          <SvgImage
            href={{ uri: cachedPhotoUri ?? photoUri }}
            x="0"
            y="0"
            width="400"
            height="400"
            preserveAspectRatio="xMidYMid slice"
          />
        </G>
      ) : (
        <>
          <Path d={CREST_PATH} transform={CLIP_TRANSFORM} fill={colors.text} />
          <SvgText
            x="200"
            y="238"
            textAnchor="middle"
            fontSize="110"
            fontWeight={WEIGHT.bold}
            fill={colors.background}>
            {initialsForName(name)}
          </SvgText>
        </>
      )}
    </Svg>
  );
}
