import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { SelectField } from '@/components/select-field';
import { InlineError } from '@/components/states';
import { TextField } from '@/components/text-field';
import { useCurrentUser } from '@/context/session';
import { createStyles } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { errorMessage } from '@/lib/api';
import { departmentApi, employeeApi } from '@/lib/endpoints';

const NEW_DEPARTMENT = '__new__';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AddEmployeeScreen() {
  const styles = useStyles();
  const user = useCurrentUser();
  // Managers always add into their own department; everyone else picks one.
  const needsDepartment = user.role !== 'MANAGER';

  const departments = useApi(
    () => (needsDepartment ? departmentApi.list().then((r) => r.data) : Promise.resolve([])),
    [needsDepartment],
  );

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [designation, setDesignation] = useState('');
  const [departmentChoice, setDepartmentChoice] = useState<string | null>(null);
  const [newDepartment, setNewDepartment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const departmentName =
    departmentChoice === NEW_DEPARTMENT
      ? newDepartment.trim()
      : (departments.data ?? []).find((department) => department.id === departmentChoice)?.name ?? '';

  const canSubmit =
    name.trim().length >= 2 &&
    EMAIL_RE.test(email.trim()) &&
    designation.trim().length > 0 &&
    (!needsDepartment || departmentName.length > 0) &&
    !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { data } = await employeeApi.add({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim() || undefined,
        designation: designation.trim(),
        ...(needsDepartment ? { department: departmentName } : {}),
      });
      router.replace({ pathname: '/employee/[id]', params: { id: data.id } });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen
      title="Add employee"
      backFallback="/people"
      footer={<PrimaryButton label="Add employee" onPress={handleSubmit} disabled={!canSubmit} loading={isSubmitting} />}>
      <Text style={styles.hint}>
        {needsDepartment
          ? 'They will receive an email with a temporary password and can log in right away.'
          : 'They will join your department and receive an email with a temporary password.'}
      </Text>

      <TextField label="Full name" icon="person-outline" value={name} onChangeText={setName} />
      <TextField
        label="Work email"
        icon="mail-outline"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextField
        label="Phone number (optional)"
        icon="call-outline"
        keyboardType="phone-pad"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
      />
      <TextField label="Designation" icon="briefcase-outline" value={designation} onChangeText={setDesignation} />

      {needsDepartment && (
        <>
          <SelectField
            label="Department"
            placeholder={departments.isLoading ? 'Loading departments…' : 'Choose a department'}
            value={departmentChoice}
            onChange={setDepartmentChoice}
            options={[
              ...(departments.data ?? []).map((department) => ({ value: department.id, label: department.name })),
              { value: NEW_DEPARTMENT, label: '+ New department' },
            ]}
          />
          {departmentChoice === NEW_DEPARTMENT && (
            <TextField
              label="New department name"
              icon="business-outline"
              value={newDepartment}
              onChangeText={setNewDepartment}
            />
          )}
        </>
      )}

      <InlineError message={error} />
    </Screen>
  );
}

const useStyles = createStyles((colors) => ({
  hint: {
    fontSize: 14,
    color: colors.textMuted,
  },
}));
