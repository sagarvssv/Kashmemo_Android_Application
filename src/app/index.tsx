import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

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
    router.replace(user ? '/home' : '/login');
  }, [isReady, minTimeElapsed, user]);

  return (
    <View style={styles.container}>
      <View style={styles.logoMark}>
        <Ionicons name="leaf" size={40} color="#FFFFFF" />
      </View>
      <Text style={styles.title}>KashMemo</Text>
      <Text style={styles.tagline}>Raise. Track. Get Paid.</Text>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoMark: {
    width: 84,
    height: 84,
    borderRadius: 20,
    backgroundColor: colors.accentTeal,
    alignItems: 'center',
    justifyContent: 'center',
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
