import React, { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';

import { themeForRole, themes, type Palette, type Theme } from '@/constants/theme';
import { useSession } from '@/context/session';

const ThemeContext = createContext<Theme>(themes.default);

// Picks the palette from the signed-in user's role. Signed-out screens (login,
// signup, password reset) use the default theme.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  return <ThemeContext.Provider value={themeForRole(user?.role)}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

export function useColors(): Palette {
  return useContext(ThemeContext).colors;
}

// Like StyleSheet.create, but built from the current theme's colours:
//
//   const useStyles = createStyles((colors) => ({ title: { color: colors.textPrimary } }));
//   function Thing() { const styles = useStyles(); ... }
//
// Each theme's sheet is built once and cached.
//
// Typed like StyleSheet.create itself (React Native 0.88+): constraining the
// factory's result to the stylesheet type keeps literal values such as
// flexDirection: 'row' or fontWeight: '700' instead of widening them to string.
type Styles = Parameters<typeof StyleSheet.create>[0];

export function createStyles<T extends Styles>(factory: (colors: Palette, theme: Theme) => T & Styles) {
  const cache = new Map<Theme, Readonly<T>>();
  return function useStyles(): Readonly<T> {
    const theme = useTheme();
    let styles = cache.get(theme);
    if (!styles) {
      styles = StyleSheet.create(factory(theme.colors, theme));
      cache.set(theme, styles);
    }
    return styles;
  };
}
