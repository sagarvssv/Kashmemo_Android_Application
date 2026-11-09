import React from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { Card, ListRow } from '@/components/card';
import { Appear } from '@/components/motion';
import { Screen } from '@/components/screen';
import { EmptyState, ErrorState, LoadingState } from '@/components/states';
import { spacing } from '@/constants/theme';
import { useCurrentUser, useRealtime } from '@/context/session';
import { useCursorList } from '@/hooks/use-api';
import { dashboardApi } from '@/lib/endpoints';
import { formatDateTime, humanize } from '@/lib/format';

export default function ActivityScreen() {
  const user = useCurrentUser();
  const list = useCursorList((cursor) => dashboardApi.recentActivity({ cursor, limit: 25 }), []);

  useRealtime(['activity'], () => {
    void list.reload();
  });

  return (
    <Screen
      title="Activity log"
      subtitle={user.role === 'MANAGER' ? 'Your department' : 'Across your organisation'}
      backFallback="/profile"
      scroll={false}>
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
          refreshControl={<RefreshControl refreshing={list.isRefreshing} onRefresh={list.refresh} />}
          onEndReached={() => void list.loadMore()}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<EmptyState icon="pulse-outline" title="No activity yet" />}
          ListFooterComponent={list.isLoadingMore ? <ActivityIndicator style={styles.footer} /> : undefined}
          renderItem={({ item, index }) => {
            const row = (
              <Card style={styles.card}>
                <ListRow
                  icon="pulse-outline"
                  title={humanize(item.type)}
                  subtitle={`${item.message}\n${item.actor?.name ?? 'Someone'} · ${formatDateTime(item.createdAt)}`}
                />
              </Card>
            );
            // Only the first screenful cascades in, so rows further down never lag while scrolling.
            return index < 10 ? <Appear index={index}>{row}</Appear> : row;
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  card: {
    paddingVertical: 0,
  },
});
