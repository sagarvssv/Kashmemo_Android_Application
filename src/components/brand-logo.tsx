import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

// KashMemo logo: a green rounded square with a white, square-cornered "6"
// drawn as a single thin line.
//
// `tile` draws the full square logo; `glyph` draws only the white "6", for use
// on a surface that is already green.
export const BRAND_GREEN = '#3f8f5f';
export const BRAND_GREEN_DARK = '#24603d';
export const BRAND_GREEN_DEEP = '#143d26';
// Soft mint accent that sits well beside the logo green.
export const BRAND_LIME = '#cdeedb';
const GLYPH_COLOR = '#f0f6f1';

type Props = {
  size?: number;
  variant?: 'tile' | 'glyph';
};

export function BrandLogo({ size = 64, variant = 'tile' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {variant === 'tile' ? <Rect x="0" y="0" width="100" height="100" rx="24" fill={BRAND_GREEN} /> : null}
      {/* Top bar, down the left side, along the bottom, up the right half and
          back across the middle. */}
      <Path
        d="M70 31 H30 V69 H70 V50 H30"
        fill="none"
        stroke={GLYPH_COLOR}
        strokeWidth="7"
        strokeLinecap="butt"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
