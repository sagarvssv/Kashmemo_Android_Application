import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { FadeInDown } from 'react-native-reanimated';

import { Segmented } from '@/components/chip-group';
import { PressableScale } from '@/components/motion';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { motion, staggerDelay } from '@/constants/motion';
import { radius, spacing } from '@/constants/theme';
import { useRealtime, useSession } from '@/context/session';
import { createStyles, useColors } from '@/context/theme';
import { useCursorList } from '@/hooks/use-api';
import { notificationApi } from '@/lib/endpoints';
import { formatRelative } from '@/lib/format';
import type { AppNotification } from '@/lib/types';

// Only the first screenful cascades in, so rows further down never lag while scrolling.
const CASCADE_ROWS = 10;

type Filter = 'all' | 'unread';

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  TICKET_RAISED_FOR_APPROVAL: 'hourglass-outline',
  TICKET_APPROVED: 'checkmark-circle-outline',
  TICKET_PARTIALLY_APPROVED: 'git-pull-request-outline',
  TICKET_REJECTED: 'close-circle-outline',
  TICKET_DISBURSED: 'cash-outline',
  BUDGET_ALLOCATED: 'pie-chart-outline',
  NEW_EMPLOYEE_ADDED: 'person-add-outline',
  DEPARTMENT_CREATED: 'business-outline',
  // Advances: bills added against them, then settlement.
  BILL_SUBMITTED_FOR_APPROVAL: 'receipt-outline',
  BILL_APPROVED: 'checkmark-done-outline',
  BILL_REJECTED: 'close-circle-outline',
  ADVANCE_SETTLEMENT_REQUESTED: 'swap-horizontal-outline',
  ADVANCE_SETTLED: 'checkmark-done-circle-outline',
};

// The notifications list: the Alerts tab, and the screen the bell on Home
// opens (with a back button, since employees have no Alerts tab).
export function NotificationsScreen({ showBack = false }: { showBack?: boolean }) {
  const styles = useStyles();
  const colors = useColors();
  const { unreadCount, refreshUnreadCount } = useSession();
  const [filter, setFilter] = useState<Filter>('all');

  const list = useCursorList(
    (cursor) => notificationApi.list({ cursor, limit: 20, unreadOnly: filter === 'unread' || undefined }),
    [filter],
  );

  useRealtime(['notification'], () => {
    void list.reload();
  });

  const markRead = (notification: AppNotification) => {
    list.setItems((items) =>
      filter === 'unread'
        ? items.filter((item) => item.id !== notification.id)
        : items.map((item) => (item.id === notification.id ? { ...item, isRead: true } : item)),
    );
    notificationApi
      .markRead(notification.id)
      .catch(() => {})
      .finally(() => void refreshUnreadCount());
  };

  const open = (notification: AppNotification) => {
    if (!notification.isRead) markRead(notification);
    const ticketId = notification.metadata?.ticketId;
    if (ticketId) router.push({ pathname: '/ticket/[id]', params: { id: ticketId } });
  };

  const markAllRead = async () => {
    list.setItems((items) => (filter === 'unread' ? [] : items.map((item) => ({ ...item, isRead: true }))));
    try {
      await notificationApi.markAllRead();
    } finally {
      await refreshUnreadCount();
    }
  };

  const refresh = async () => {
    await Promise.all([list.refresh(), refreshUnreadCount()]);
  };

  return (
    <Screen
      title="Notifications"
      subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
      backFallback={showBack ? '/home' : undefined}
      scroll={false}
      right={
        unreadCount > 0 ? (
          <Pressable onPress={markAllRead} hitSlop={8}>
            <Text style={styles.markAll}>Mark all read</Text>
          </Pressable>
        ) : undefined
      }>
      <View style={styles.filters}>
        <Segmented
          options={[
            { value: 'all', label: 'All' },
            { value: 'unread', label: 'Unread' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </View>

      {list.isLoading && list.items.length === 0 ? (
        <LoadingState />
      ) : list.error && list.items.length === 0 ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={<RefreshControl refreshing={list.isRefreshing} onRefresh={refresh} />}
          onEndReached={() => void list.loadMore()}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<EmptyState icon="notifications-off-outline" title="No notifications" />}
          ListFooterComponent={list.isLoadingMore ? <ActivityIndicator style={styles.footer} /> : undefined}
          renderItem={({ item, index }) => (
            <PressableScale
              entering={index < CASCADE_ROWS ? FadeInDown.duration(motion.enterDuration).delay(staggerDelay(index)) : undefined}
              onPress={() => open(item)}
              style={({ pressed }) => [styles.item, !item.isRead && styles.unread, pressed && { opacity: 0.7 }]}>
              <View style={styles.icon}>
                <Ionicons name={ICONS[item.type] ?? 'notifications-outline'} size={20} color={colors.primary} />
              </View>
              <View style={styles.text}>
                <Text style={[styles.message, !item.isRead && styles.messageUnread]}>{item.message}</Text>
                {item.metadata?.rejectionReason ? (
                  <Text style={styles.detail}>Reason: {item.metadata.rejectionReason}</Text>
                ) : null}
                <Text style={styles.time}>{formatRelative(item.createdAt)}</Text>
              </View>
              {!item.isRead && <View style={styles.dot} />}
            </PressableScale>
          )}
        />
      )}
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  markAll: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  filters: {
    paddingHorizontal: spacing.four,
    paddingBottom: spacing.three,
  },
  list: {
    paddingHorizontal: spacing.four,
    paddingBottom: spacing.eight,
  },
  separator: {
    height: spacing.two,
  },
  footer: {
    paddingVertical: spacing.four,
  },
  item: {
    flexDirection: 'row',
    gap: spacing.three,
    backgroundColor: colors.surface,
    borderRadius: radius.medium,
    padding: spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderLight,
  },
  unread: {
    borderColor: colors.primary,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    gap: 4,
  },
  message: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  messageUnread: {
    fontWeight: '600',
  },
  detail: {
    fontSize: 13,
    color: colors.textMuted,
  },
  time: {
    fontSize: 12,
    color: colors.textMuted,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
}));
