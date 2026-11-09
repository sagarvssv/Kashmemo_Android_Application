import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Linking, Text, View } from 'react-native';

import { Card, Divider, KeyValue, ListRow, Section } from '@/components/card';
import { PromptModal } from '@/components/prompt-modal';
import { Screen } from '@/components/screen';
import { SelectField } from '@/components/select-field';
import { ErrorState, InlineError, LoadingState } from '@/components/states';
import { Tag } from '@/components/status-badge';
import { spacing } from '@/constants/theme';
import { useCurrentUser } from '@/context/session';
import { createStyles } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { errorMessage } from '@/lib/api';
import { employeeApi } from '@/lib/endpoints';
import { initials, ROLE_LABELS } from '@/lib/format';
import { can } from '@/lib/permissions';
import { USER_ROLES, type UserRole } from '@/lib/types';

export default function EmployeeDetailScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useCurrentUser();
  const [isEditing, setIsEditing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const employee = useApi(() => employeeApi.details(id).then((r) => r.data), [id]);

  if (employee.isLoading && !employee.data) {
    return (
      <Screen title="Employee" backFallback="/people">
        <LoadingState />
      </Screen>
    );
  }
  if (!employee.data) {
    return (
      <Screen title="Employee" backFallback="/people">
        <ErrorState message={employee.error ?? 'Employee not found.'} onRetry={employee.reload} />
      </Screen>
    );
  }

  const data = employee.data;
  const isSelf = data.id === user.userId;
  const isProtectedRole = data.role === 'CEO' || data.role === 'MANAGER';
  const managerCanEdit = can.manageOwnDepartmentEmployees(user.role) && !isProtectedRole && !isSelf;
  const canDelete = !isSelf && data.role !== 'CEO' && (can.deleteEmployeeOrgWide(user.role) || managerCanEdit);
  const canChangeRole = can.changeRole(user.role) && data.role !== 'CEO' && !isSelf;
  const canManageManager = can.manageManagers(user.role) && data.role === 'MANAGER';
  const hasRowActions = canManageManager || managerCanEdit || canDelete;

  const changeRole = (role: UserRole) => {
    if (role === data.role) return;
    Alert.alert('Change role', `Make ${data.name} a ${ROLE_LABELS[role]}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Change',
        onPress: async () => {
          setActionError(null);
          try {
            await employeeApi.changeRole(data.id, role);
            await employee.reload();
          } catch (err) {
            setActionError(errorMessage(err));
          }
        },
      },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert('Remove employee', `Remove ${data.name} from your organisation? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setActionError(null);
          try {
            if (can.deleteEmployeeOrgWide(user.role)) {
              await employeeApi.remove(data.id);
            } else {
              await employeeApi.removeAsManager(data.id);
            }
            router.back();
          } catch (err) {
            setActionError(errorMessage(err));
          }
        },
      },
    ]);
  };

  return (
    <Screen title={data.name} backFallback="/people" refreshing={employee.isRefreshing} onRefresh={employee.refresh}>
      <Card style={styles.hero}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(data.name)}</Text>
        </View>
        <Text style={styles.name}>{data.name}</Text>
        {data.designation ? <Text style={styles.designation}>{data.designation}</Text> : null}
        <Tag label={ROLE_LABELS[data.role]} />
      </Card>

      <Section title="Contact">
        <Card>
          <ListRow
            icon="mail-outline"
            title={data.email}
            onPress={() => Linking.openURL(`mailto:${data.email}`)}
          />
          {data.phoneNumber ? (
            <>
              <Divider />
              <ListRow
                icon="call-outline"
                title={data.phoneNumber}
                onPress={() => Linking.openURL(`tel:${data.phoneNumber}`)}
              />
            </>
          ) : null}
        </Card>
      </Section>

      <Section title="Work">
        <Card>
          <KeyValue label="Department" value={data.department?.name ?? 'Not assigned'} />
          <Divider />
          <KeyValue label="Organisation" value={data.organization.companyName} />
        </Card>
      </Section>

      <InlineError message={actionError} />

      {(canChangeRole || hasRowActions) && (
        <Section title="Manage">
          {canChangeRole && (
            <SelectField
              label="Role"
              value={data.role}
              options={USER_ROLES.filter((role) => role !== 'CEO').map((role) => ({
                value: role,
                label: ROLE_LABELS[role],
              }))}
              onChange={(value) => changeRole(value as UserRole)}
            />
          )}
          {hasRowActions && (
            <Card style={styles.actionsCard}>
              {canManageManager && (
                <ListRow
                  icon="git-network-outline"
                  title="Departments & approval limits"
                  subtitle="Primary department, extra departments and limits"
                  onPress={() => router.push({ pathname: '/manager/[id]', params: { id: data.id, name: data.name } })}
                />
              )}
              {managerCanEdit && (
                <ListRow icon="create-outline" title="Edit details" onPress={() => setIsEditing(true)} />
              )}
              {canDelete && (
                <ListRow icon="trash-outline" title="Remove employee" destructive onPress={confirmDelete} />
              )}
            </Card>
          )}
        </Section>
      )}

      <PromptModal
        visible={isEditing}
        title="Edit details"
        fields={[
          { key: 'name', label: 'Name', initialValue: data.name },
          { key: 'designation', label: 'Designation', initialValue: data.designation ?? '' },
          {
            key: 'phoneNumber',
            label: 'Phone number',
            initialValue: data.phoneNumber ?? '',
            keyboardType: 'phone-pad',
            optional: true,
          },
        ]}
        confirmLabel="Save"
        onClose={() => setIsEditing(false)}
        onSubmit={async (values) => {
          await employeeApi.editAsManager(data.id, values);
          await employee.reload();
        }}
      />
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  hero: {
    alignItems: 'center',
    gap: spacing.two,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentTeal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  designation: {
    fontSize: 14,
    color: colors.textMuted,
  },
  actionsCard: {
    gap: 0,
    paddingVertical: spacing.one,
  },
}));
