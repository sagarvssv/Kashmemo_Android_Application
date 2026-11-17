import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, type ColorValue } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { typography } from '@/constants/theme';

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
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      // The floating bar keeps clear of the system navigation bar itself.
      safeAreaInsets={{ bottom: 0 }}
      screenListeners={{ tabPress: () => haptics.select() }}
      screenOptions={{
        headerShown: false,
        // Screens slide slightly and cross-fade when switching tabs.
        animation: 'shift',
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.label,
        // Floating, rounded bar like the iOS app (in this app's own colours).
        tabBarStyle: [
          styles.bar,
          {
            backgroundColor: colors.surface,
            borderColor: colors.borderLight,
            marginBottom: Math.max(insets.bottom, 12),
          },
        ],
        tabBarItemStyle: styles.item,
        tabBarBadgeStyle: [styles.badge, { backgroundColor: colors.danger }],
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen
        name="bills"
        options={{
          // Employee: spent their own money, uploads the bill to get the cash back.
          title: 'Cash request',
          tabBarIcon: tabIcon('document-text-outline', 'document-text'),
          // Other roles reach My bills from Home or More (see can.billsTab).
          href: employeeView ? undefined : null,
        }}
      />
      {/* Employee: cash given before spending; add its bills and settle here.
          Everyone else: every bill and cash request they can see. */}
      <Tabs.Screen
        name="tickets"
        options={
          employeeView
            ? { title: 'Bills', tabBarIcon: tabIcon('cash-outline', 'cash') }
            : { title: 'Bills', tabBarIcon: tabIcon('receipt-outline', 'receipt') }
        }
      />
      {/* Managers, Finance and HR scan a bill from this tab (employees from
          Home). The CEO heads the organisation and doesn't claim money.
          It opens the scan screen instead of showing a tab of its own. */}
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: tabIcon('scan-outline', 'scan'),
          href: !employeeView && invoiceApiEnabled && user.role !== 'CEO' ? undefined : null,
        }}
        listeners={{
          tabPress: (event) => {
            event.preventDefault();
            router.push('/upload-bill');
          },
        }}
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
        options={{ title: 'Menu', tabBarIcon: tabIcon('menu-outline', 'menu') }}
      />
    </Tabs>
  );
}
const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    marginHorizontal: 16,
    height: 66,
    paddingTop: 8,
    paddingBottom: 8,
    borderRadius: 26,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderWidth: StyleSheet.hairlineWidth,
    elevation: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  item: {
    paddingVertical: 2,
  },
  label: {
    ...typography.micro,
  },
  badge: {
    ...typography.micro,
    fontWeight: '700',
  },
});
