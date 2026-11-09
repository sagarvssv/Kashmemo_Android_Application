import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import type { ColorValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { useCurrentUser, useSession } from '@/context/session';
import { useColors } from '@/context/theme';
import { haptics } from '@/lib/haptics';
import { invoiceApiEnabled } from '@/lib/invoices';
import { can } from '@/lib/permissions';

type IconName = keyof typeof Ionicons.glyphMap;

// The icon pops slightly when its tab becomes active.
function AnimatedTabIcon({ name, color, size, focused }: { name: IconName; color: ColorValue; size: number; focused: boolean }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (focused) {
      scale.set(withSequence(
        withSpring(1.18, { damping: 12, stiffness: 420, mass: 0.5 }),
        withSpring(1, { damping: 14, stiffness: 300 }),
      ));
    }
  }, [focused, scale]);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Animated.View style={animatedStyle}>
      <Ionicons name={name} size={size} color={color as string} />
    </Animated.View>
  );
}

function tabIcon(name: IconName, focusedName: IconName) {
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <AnimatedTabIcon name={focused ? focusedName : name} color={color} size={size} focused={focused} />;
  };
}

export default function TabsLayout() {
  const colors = useColors();
  const user = useCurrentUser();
  const { unreadCount } = useSession();
  const employeeView = can.billsTab(user.role) && invoiceApiEnabled;

  return (
    <Tabs
      screenListeners={{ tabPress: () => haptics.select() }}
      screenOptions={{
        headerShown: false,
        // Screens slide slightly and cross-fade when switching tabs.
        animation: 'shift',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.borderLight },
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen
        name="bills"
        options={{
          // Claims: own money spent, paid back. (Advances: cash given first.)
          title: 'Claims',
          tabBarIcon: tabIcon('document-text-outline', 'document-text'),
          // Other roles reach My claims from Home or More (see can.billsTab).
          href: employeeView ? undefined : null,
        }}
      />
      {/* Employees only see their advances here; claims live in Claims. */}
      <Tabs.Screen
        name="tickets"
        options={
          employeeView
            ? { title: 'Advances', tabBarIcon: tabIcon('cash-outline', 'cash') }
            : { title: 'Tickets', tabBarIcon: tabIcon('receipt-outline', 'receipt') }
        }
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'People',
          tabBarIcon: tabIcon('people-outline', 'people'),
          href: can.viewPeople(user.role) ? undefined : null,
        }}
      />
      {/* Employees open notifications from the bell on Home instead. */}
      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          href: employeeView ? null : undefined,
          tabBarIcon: tabIcon('notifications-outline', 'notifications'),
          tabBarBadge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : unreadCount) : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'More', tabBarIcon: tabIcon('ellipsis-horizontal-circle-outline', 'ellipsis-horizontal-circle') }}
      />
    </Tabs>
  );
}