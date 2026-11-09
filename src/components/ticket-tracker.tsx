import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, View } from 'react-native';

import { radius, spacing } from '@/constants/theme';
import { useCurrentUser } from '@/context/session';
import { createStyles, useColors, useTheme } from '@/context/theme';
import type { TicketStatus, UserRole } from '@/lib/types';

type IconName = keyof typeof Ionicons.glyphMap;

type Step = { label: string; icon: IconName };

// A bill paid with the employee's own money: approved, then paid back.
const BILL_STEPS: Step[] = [
  { label: 'Sent', icon: 'paper-plane' },
  { label: 'Approved', icon: 'thumbs-up' },
  { label: 'Paid', icon: 'cash' },
];

// An advance: approved, cash handed over (bills are added while spending),
// then closed with finance (settled).
const ADVANCE_STEPS: Step[] = [
  { label: 'Sent', icon: 'paper-plane' },
  { label: 'Approved', icon: 'thumbs-up' },
  { label: 'Cash given', icon: 'cash' },
  { label: 'Closed', icon: 'checkmark-done' },
];

// How many steps are finished for each status.
const STEPS_DONE: Record<TicketStatus, number> = {
  PENDING: 1,
  PARTIALLY_APPROVED: 1,
  APPROVED: 2,
  DISBURSED: 3,
  SETTLEMENT_PENDING: 3,
  SETTLED: 4,
  REJECTED: 1,
};

// Worded for the person who raised the advance...
const OWN_TEXT: Record<TicketStatus, string> = {
  PENDING: 'Waiting for your manager to approve',
  PARTIALLY_APPROVED: 'Your manager approved. Waiting for final approval',
  APPROVED: 'Approved. Collect your cash from finance',
  DISBURSED: 'You have the cash. Add a photo of each bill as you spend',
  SETTLEMENT_PENDING: 'You finished spending. Waiting for finance to close it',
  SETTLED: 'Closed. All done',
  REJECTED: 'Not approved',
};

// ...and for everyone else looking at it.
const OTHER_TEXT: Record<TicketStatus, string> = {
  PENDING: 'Waiting for approval',
  PARTIALLY_APPROVED: 'Partly approved. Waiting for final approval',
  APPROVED: 'Approved. Waiting for finance to hand over the cash',
  DISBURSED: 'Cash given. The employee is adding bills',
  SETTLEMENT_PENDING: 'Finished spending. Ready for finance to settle',
  SETTLED: 'Closed',
  REJECTED: 'Not approved',
};

// Bills (receipt tickets) have one approver and end when paid back.
const OWN_BILL_TEXT: Partial<Record<TicketStatus, string>> = {
  PENDING: 'Waiting for approval',
  APPROVED: 'Approved. Collect your cash from finance',
  DISBURSED: 'Money paid to you',
};
const OTHER_BILL_TEXT: Partial<Record<TicketStatus, string>> = {
  APPROVED: 'Approved. Waiting for finance to pay',
  DISBURSED: 'Paid out',
};

// Who approves an advance depends on who raised it (approverRolesFor in
// permissions.ts): a Manager's goes to finance, a Finance Manager's to the CEO.
const OWN_PENDING_BY_ROLE: Partial<Record<UserRole, string>> = {
  MANAGER: 'Waiting for finance to approve',
  FINANCE_MANAGER: 'Waiting for the CEO to approve',
};

export function trackerText(status: TicketStatus, isMine: boolean, isBill = false, myRole?: UserRole) {
  if (isBill) {
    const text = (isMine ? OWN_BILL_TEXT : OTHER_BILL_TEXT)[status];
    if (text) return text;
  }
  if (isMine && status === 'PENDING' && myRole && OWN_PENDING_BY_ROLE[myRole]) return OWN_PENDING_BY_ROLE[myRole];
  return (isMine ? OWN_TEXT : OTHER_TEXT)[status];
}

// The ticket's steps (Sent → Approved → Paid for a bill; Sent → Approved →
// Cash given → Settled for an advance), finished ones in green, a rejected
// ticket stopping at a red "Approved" step, plus one plain sentence on what
// happens next.
export function TicketTracker({
  status,
  isMine,
  isBill,
  detail,
}: {
  status: TicketStatus;
  isMine: boolean;
  // A ticket made from a scanned bill (source RECEIPT).
  isBill?: boolean;
  // Appended to the sentence, e.g. the rejection reason.
  detail?: string | null;
}) {
  const styles = useStyles();
  const colors = useColors();
  const { statusColors } = useTheme();
  const user = useCurrentUser();
  const text = trackerText(status, isMine, isBill, user.role);
  const rejected = status === 'REJECTED';
  const steps = isBill ? BILL_STEPS : ADVANCE_STEPS;
  const done = Math.min(STEPS_DONE[status], steps.length);
  const tone = statusColors[status];

  return (
    <View style={styles.container} accessible accessibilityLabel={text}>
      <View style={styles.tracker}>
        {steps.map((step, index) => {
          const isDone = index < done;
          const isFailed = rejected && index === 1;
          const background = isFailed ? colors.danger : isDone ? colors.success : colors.borderLight;
          return (
            <React.Fragment key={step.label}>
              {index > 0 ? (
                <View style={[styles.line, { backgroundColor: index < done ? colors.success : colors.borderLight }]} />
              ) : null}
              <View style={styles.step}>
                <View style={[styles.dot, { backgroundColor: background }]}>
                  <Ionicons
                    name={isFailed ? 'close' : step.icon}
                    size={16}
                    color={isDone || isFailed ? '#FFFFFF' : colors.textMuted}
                  />
                </View>
                <Text style={[styles.label, (isDone || isFailed) && styles.labelActive]}>
                  {isFailed ? 'Rejected' : step.label}
                </Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      <View style={[styles.next, { backgroundColor: tone.background }]}>
        <Text style={[styles.nextText, { color: tone.text }]}>
          {text}
          {detail ? `: ${detail}` : ''}
        </Text>
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: {
    gap: spacing.three,
  },
  tracker: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.two,
  },
  step: {
    alignItems: 'center',
    gap: spacing.one,
    width: 64,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sits level with the middle of the dots.
  line: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    marginTop: 15,
    marginHorizontal: -spacing.three,
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  next: {
    borderRadius: radius.small,
    paddingVertical: spacing.two,
    paddingHorizontal: spacing.three,
  },
  nextText: {
    fontSize: 14,
    fontWeight: '600',
  },
}));
