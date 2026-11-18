import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { BRAND_GREEN_DEEP, BrandLogo } from '@/components/brand-logo';
import { useSession } from '@/context/session';
import { createStyles } from '@/context/theme';

const MIN_SPLASH_MS = 1200;

// This route is also where Stack.Protected lands after every sign-in and
// sign-out, so only hold the splash on the first launch.
let hasShownSplash = false;

export default function SplashScreen() {
  const styles = useStyles();
  const { user, isReady } = useSession();
  const [minTimeElapsed, setMinTimeElapsed] = useState(hasShownSplash);

  useEffect(() => {
    if (hasShownSplash) return;
    const timer = setTimeout(() => {
      hasShownSplash = true;
      setMinTimeElapsed(true);
    }, MIN_SPLASH_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady || !minTimeElapsed) return;
    router.replace(user ? '/home' : '/welcome');
  }, [isReady, minTimeElapsed, user]);

  // After sign-in or sign-out this route is only passed through on the way to
  // Home or Welcome, so show a plain background instead of flashing the splash.
  if (hasShownSplash) return <View style={styles.passThrough} />;

  return (
    <View style={styles.container}>
      <View style={styles.logoMark}>
        <BrandLogo size={88} />
      </View>
      <Text style={styles.title}>KashMemo</Text>
      <Text style={styles.tagline}>Raise. Track. Get Paid.</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  passThrough: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    // Same as the native splash background (app.json), so there is no flash.
    backgroundColor: BRAND_GREEN_DEEP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: {
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  tagline: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(255,255,255,0.75)',
  },
}));
