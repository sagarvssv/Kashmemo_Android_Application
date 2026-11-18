import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

// KashMemo logo: a bright green rounded square with a solid white "6" (a flat
// top bar with a rounded tip, a thick left stem, and a rounded box at the
// bottom). Drawn on a 100 x 100 grid from the official logo artwork.
//
// `tile` draws the full square logo; `glyph` draws only the white "6", for use
// on a surface that is already green.
export const BRAND_GREEN = '#03a343';
export const BRAND_GREEN_DARK = '#028337';
export const BRAND_GREEN_DEEP = '#014d21';
// Soft mint accent that sits well beside the logo green.
export const BRAND_LIME = '#d4f5e0';
const GLYPH_COLOR = '#ffffff';
const TILE_RADIUS = 26;

// The "6": outer outline, then the inner box (cut out with even-odd fill).
// Keep in sync with the icon generator (scripts that render the app icons).
export const BRAND_GLYPH_PATH =
  'M25.9 39.3 A11 11 0 0 1 36.9 28.3 L71.6 28.3 A3.4 3.4 0 0 1 71.6 35.1 L38.8 35.1 ' +
  'A3.5 3.5 0 0 0 35.3 38.6 L35.3 43.3 L66.6 43.3 A11 11 0 0 1 77.6 54.3 L77.6 58.5 ' +
  'A11 11 0 0 1 66.6 69.5 L36.9 69.5 A11 11 0 0 1 25.9 58.5 Z ' +
  'M35.3 49.7 L65.3 49.7 A3 3 0 0 1 68.3 52.7 L68.3 59.5 A3 3 0 0 1 65.3 62.5 ' +
  'L38.3 62.5 A3 3 0 0 1 35.3 59.5 Z';

type Props = {
  size?: number;
  variant?: 'tile' | 'glyph';
};

export function BrandLogo({ size = 64, variant = 'tile' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {variant === 'tile' ? (
        <Rect x="0" y="0" width="100" height="100" rx={TILE_RADIUS} fill={BRAND_GREEN} />
      ) : null}
      <Path d={BRAND_GLYPH_PATH} fill={GLYPH_COLOR} fillRule="evenodd" />
    </Svg>
  );
}
