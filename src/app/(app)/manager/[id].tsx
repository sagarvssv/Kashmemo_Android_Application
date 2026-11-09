import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, Text, View } from 'react-native';

import { Card, ListRow, Section } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { PromptModal } from '@/components/prompt-modal';
import { Screen } from '@/components/screen';
import { SelectField } from '@/components/select-field';
import { EmptyState, ErrorState, InlineError, LoadingState } from '@/components/states';
import { Tag } from '@/components/status-badge';
import { spacing } from '@/constants/theme';
import { createStyles, useColors } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { errorMessage } from '@/lib/api';
import { departmentApi, managerApi } from '@/lib/endpoints';
import type { ManagerDepartment } from '@/lib/types';

export default function ManagerDepartmentsScreen() {
  const styles = useStyles();
  const colors = useColors();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [limitFor, setLimitFor] = useState<ManagerDepartment | null>(null);
  const [isEditingExtras, setIsEditingExtras] = useState(false);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const assigned = useApi(() => managerApi.departments(id).then((r) => r.data), [id]);
  const allDepartments = useApi(() => departmentApi.list().then((r) => r.data), []);

  const assignedList = assigned.data ?? [];
  const primary = assignedList.find((department) => department.isPrimary);
  const extras = assignedList.filter((department) => !department.isPrimary);
  const assignedIds = new Set(assignedList.map((department) => department.id));
  const unassigned = (allDepartments.data ?? []).filter((department) => !assignedIds.has(department.id));

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      await assigned.reload();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const openDepartmentActions = (department: ManagerDepartment) => {
    const options = department.isPrimary
      ? ['Set approval limit', 'Cancel']
      : ['Set approval limit', 'Make primary department', 'Remove from manager', 'Cancel'];
    const handle = (index: number) => {
      if (index === 0) setLimitFor(department);
      if (!department.isPrimary && index === 1) {
        void run(() => managerApi.setPrimaryDepartment(id, department.id));
      }
      if (!department.isPrimary && index === 2) {
        void run(() => managerApi.unassignDepartment(id, department.id));
      }
    };

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: department.name,
          options,
          cancelButtonIndex: options.length - 1,
          destructiveButtonIndex: department.isPrimary ? undefined : 2,
        },
        handle,
      );
    } else {
      Alert.alert(
        department.name,
        undefined,
        options.map((label, index) => ({
          text: label,
          style: label === 'Cancel' ? 'cancel' : label.startsWith('Remove') ? 'destructive' : 'default',
          onPress: () => handle(index),
        })),
      );
    }
  };

  const startEditingExtras = () => {
    setSelectedExtras(extras.map((department) => department.id));
    setIsEditingExtras(true);
  };

  const toggleExtra = (departmentId: string) => {
    setSelectedExtras((current) =>
      current.includes(departmentId) ? current.filter((value) => value !== departmentId) : [...current, departmentId],
    );
  };

  const saveExtras = async () => {
    setIsSaving(true);
    await run(() => managerApi.replaceDepartments(id, selectedExtras));
    setIsSaving(false);
    setIsEditingExtras(false);
  };

  return (
    <Screen
      title={name ?? 'Manager'}
      subtitle="Departments & approval limits"
      backFallback="/people"
      refreshing={assigned.isRefreshing}
      onRefresh={assigned.refresh}>
      <Text style={styles.hint}>
        A manager approves tickets for every department listed here, up to the approval limit set for each one.
      </Text>

      <InlineError message={error} />

      {assigned.isLoading && !assigned.data ? <LoadingState /> : null}
      {/* The backend answers 400 "not assigned to a department" for a manager without a primary department. */}
      {assigned.error && !assigned.data ? (
        assigned.error.includes('not assigned') ? (
          <Text style={styles.hint}>This manager has no primary department yet. Choose one below to get started.</Text>
        ) : (
          <ErrorState message={assigned.error} onRetry={assigned.reload} />
        )
      ) : null}

      {!assigned.isLoading && !primary && (
        <SelectField
          label="Primary department"
          placeholder="Choose a primary department"
          value={null}
          options={(allDepartments.data ?? []).map((department) => ({ value: department.id, label: department.name }))}
          onChange={(departmentId) => void run(() => managerApi.setPrimaryDepartment(id, departmentId))}
        />
      )}

      {assigned.data && !isEditingExtras && (
        <Section title="Assigned departments" action={{ label: 'Edit extras', onPress: startEditingExtras }}>
          <Card style={styles.rows}>
            {assignedList.length === 0 ? <EmptyState icon="business-outline" title="No departments assigned" /> : null}
            {assignedList.map((department) => (
              <ListRow
                key={department.id}
                icon={department.isPrimary ? 'star' : 'business-outline'}
                title={department.name}
                right={department.isPrimary ? <Tag label="Primary" /> : undefined}
                onPress={() => openDepartmentActions(department)}
              />
            ))}
          </Card>
        </Section>
      )}

      {assigned.data && !isEditingExtras && unassigned.length > 0 && (
        <SelectField
          label="Add a department"
          placeholder="Assign another department"
          value={null}
          options={unassigned.map((department) => ({ value: department.id, label: department.name }))}
          onChange={(departmentId) => void run(() => managerApi.assignDepartment(id, departmentId))}
        />
      )}

      {isEditingExtras && (
        <Section title="Extra departments">
          <Card style={styles.rows}>
            {(allDepartments.data ?? [])
              .filter((department) => department.id !== primary?.id)
              .map((department) => {
                const checked = selectedExtras.includes(department.id);
                return (
                  <Pressable key={department.id} onPress={() => toggleExtra(department.id)} style={styles.checkRow}>
                    <Ionicons
                      name={checked ? 'checkbox' : 'square-outline'}
                      size={22}
                      color={checked ? colors.primary : colors.textMuted}
                    />
                    <Text style={styles.checkLabel}>{department.name}</Text>
                  </Pressable>
                );
              })}
          </Card>
          <View style={styles.editActions}>
            <PrimaryButton
              label="Cancel"
              variant="secondary"
              onPress={() => setIsEditingExtras(false)}
              style={styles.flex}
            />
            <PrimaryButton label="Save" onPress={saveExtras} loading={isSaving} style={styles.flex} />
          </View>
        </Section>
      )}

      <PromptModal
        visible={limitFor !== null}
        title="Approval limit"
        message={
          limitFor
            ? `Maximum ticket amount this manager can approve in ${limitFor.name}. The default is 1,000.`
            : undefined
        }
        fields={[{ key: 'limit', label: 'Limit', keyboardType: 'decimal-pad', placeholder: '1000' }]}
        confirmLabel="Save limit"
        onClose={() => setLimitFor(null)}
        onSubmit={async ({ limit }) => {
          const parsed = Number(limit.replace(/,/g, ''));
          if (!Number.isFinite(parsed) || parsed <= 0) throw new Error('Enter a limit greater than 0.');
          if (limitFor) await managerApi.setApprovalLimit(id, limitFor.id, parsed);
        }}
      />
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  hint: {
    fontSize: 14,
    color: colors.textMuted,
  },
  rows: {
    gap: 0,
    paddingVertical: spacing.one,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    paddingVertical: spacing.three,
  },
  checkLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  editActions: {
    flexDirection: 'row',
    gap: spacing.three,
  },
  flex: {
    flex: 1,
  },
}));
