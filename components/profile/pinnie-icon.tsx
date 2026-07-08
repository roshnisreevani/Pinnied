import Svg, { Path } from 'react-native-svg';

// The solid pinnie (sleeveless mesh training vest) shape from PennieBadge,
// extracted so other spots (e.g. the profile stat row) can render it at any
// size/color without the badge's count overlay and label.
export function PinnieIcon({ size = 17, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size * 1.1} viewBox="0 0 100 110">
      <Path d="M18,0 L38,0 L38,22 L18,22 Z" fill={color} />
      <Path d="M62,0 L82,0 L82,22 L62,22 Z" fill={color} />
      <Path
        d="M12,14 Q12,8 20,8 L38,8 Q50,22 62,8 L80,8 Q88,8 88,14 L88,96 Q88,104 80,104 L20,104 Q12,104 12,96 Z"
        fill={color}
      />
    </Svg>
  );
}
