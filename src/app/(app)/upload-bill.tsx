import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { BillPhoto } from '@/components/bill-photo';
import { AmountInput, CategoryPicker, parseAmount, Step } from '@/components/form-steps';
import { PressableScale } from '@/components/motion';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { ErrorState, InlineError } from '@/components/states';
import { TextField } from '@/components/text-field';
import { radius, spacing } from '@/constants/theme';
import { useCurrency, useFormatMoney } from '@/context/currency';
import { useCurrentUser } from '@/context/session';
import { createStyles, useColors } from '@/context/theme';
import { useApi } from '@/hooks/use-api';
import { type BillFile, type BillScan, useBillScan } from '@/hooks/use-bill-scan';
import { addBillToAdvance, submitBillForApproval } from '@/features/bills/bill-tickets';
import { ApiError, errorMessage } from '@/lib/api';
import { ticketApi } from '@/lib/endpoints';
import { LOCALE } from '@/lib/config';
import { formatDate } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { type InvoiceCategory, type InvoiceFields, invoiceApi, invoiceApiEnabled } from '@/lib/invoices';

// Fields the bill must have before it can be sent; asked for only when the
// reader could not find them.
const REQUIRED_FIELDS: { key: 'vendorName' | 'invoiceNumber' | 'invoiceDate'; label: string; placeholder: string }[] = [
  { key: 'vendorName', label: 'Shop name', placeholder: 'Name of the shop' },
  { key: 'invoiceNumber', label: 'Bill number', placeholder: 'Number printed on the bill' },
  { key: 'invoiceDate', label: 'Date on the bill', placeholder: 'YYYY-MM-DD, e.g. 2026-10-15' },
];

const FIELD_NAMES: Record<string, string> = {
  invoiceNumber: 'bill number',
  invoiceDate: 'date',
  vendorName: 'shop name',
  totalAmount: 'total',
};

// Claiming back money already spent: a photo of the bill is required. The bill
// reader (Invoice API) fills in the amount and type; the user checks and sends.
// Opened with ?invoiceId=… it continues a bill uploaded earlier (from My claims).
export default function UploadBillScreen() {
  const styles = useStyles();
  const user = useCurrentUser();
  const { currency } = useCurrency();
  const formatMoney = useFormatMoney();
  // ?invoiceId= continues a bill uploaded earlier; ?advanceId= comes from an
  // advance's "Add a bill" button and preselects that advance.
  const { invoiceId: resumeId, advanceId } = useLocalSearchParams<{ invoiceId?: string; advanceId?: string }>();
  // Advances whose cash the user collected can take bills (status DISBURSED).
  const wallet = useApi(() => ticketApi.wallet().then((r) => r.data), []);
  const spendable = (wallet.data?.openAdvances ?? []).filter((advance) => advance.status === 'DISBURSED');
  // Which money paid for the bill: an advance's id, or 'own' for the user's own money.
  const [paidWith, setPaidWith] = useState<string | null>(advanceId ?? null);
  const { scan, start, resume, retry, reset } = useBillScan(user.userId);
  const [bill, setBill] = useState<BillFile | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<InvoiceCategory | null>(null);
  const [missing, setMissing] = useState<Partial<Record<(typeof REQUIRED_FIELDS)[number]['key'], string>>>({});
  const [fromBill, setFromBill] = useState({ amount: false, category: false });
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (resumeId) void resume(resumeId);
  }, [resumeId, resume]);

  // Once a bill has been read, fill in what it says. Done while rendering
  // (not in a callback) so it runs once per bill with the current answers.
  const [appliedInvoiceId, setAppliedInvoiceId] = useState<string | null>(null);
  if (scan.state === 'done' && scan.invoice.invoiceId !== appliedInvoiceId) {
    setAppliedInvoiceId(scan.invoice.invoiceId);
    const extracted = scan.invoice.extracted ?? {};
    const filled = { amount: false, category: false };
    if (extracted.totalAmount && extracted.totalAmount > 0) {
      setAmount(String(extracted.totalAmount));
      filled.amount = true;
    }
    if (scan.invoice.category) {
      setCategory(scan.invoice.category);
      filled.category = true;
    }
    setMissing({});
    setFromBill(filled);
  }

  const handleBillChange = (next: BillFile | null) => {
    setBill(next);
    setError(null);
    setAmount('');
    setCategory(null);
    setFromBill({ amount: false, category: false });
    setAppliedInvoiceId(null);
    if (next) void start(next);
    else reset();
  };

  const invoice = scan.state === 'done' ? scan.invoice : null;
  const parsedAmount = parseAmount(amount);
  // Required fields the reader could not find, which the user must type in.
  const missingKeys = REQUIRED_FIELDS.filter(
    (field) => invoice?.missingFields?.includes(field.key) && !invoice.extracted?.[field.key],
  );
  const missingOk = missingKeys.every((field) => (missing[field.key] ?? '').trim().length > 0);
  // With open advances the user says which money they used; otherwise it was
  // their own. (An advance that is no longer open can't be chosen.)
  const chosenAdvance = spendable.find((advance) => advance.id === paidWith);
  // Opened from an advance's "Add a bill": that advance paid, so don't ask.
  const fromAdvance = Boolean(advanceId) && chosenAdvance?.id === advanceId;
  const needsChoice = spendable.length > 0 && !fromAdvance;
  const choiceOk = !needsChoice || paidWith === 'own' || Boolean(chosenAdvance);
  const onAdvance = Boolean(chosenAdvance) && (needsChoice || fromAdvance);
  // The backend files an own-money bill's ticket under the user's department.
  const hasDepartment = Boolean(user.departmentId) || onAdvance;
  const canSubmit =
    Boolean(invoice) &&
    hasDepartment &&
    parsedAmount !== null &&
    category !== null &&
    missingOk &&
    choiceOk &&
    !isSubmitting;
  const isReading = scan.state === 'sending' || scan.state === 'reading';

  const buttonLabel = !bill && !resumeId
    ? 'Add a photo of the bill'
    : isReading
      ? 'Reading your bill…'
      : scan.state === 'duplicate'
        ? 'This bill was already used'
        : scan.state === 'failed'
          ? 'Try again or take a new photo'
          : parsedAmount === null
            ? 'Enter the amount'
            : category === null
              ? 'Choose what it was for'
              : !missingOk
                ? 'Fill in the missing details'
                : !choiceOk
                  ? 'Choose which money you used'
                  : !hasDepartment
                    ? 'Ask your admin to add you to a department'
                    : onAdvance
                      ? 'Add to my advance'
                      : 'Send my claim';

  const handleSubmit = async () => {
    if (!canSubmit || !invoice || parsedAmount === null || !category) return;
    setIsSubmitting(true);
    setError(null);
    const fields: Partial<InvoiceFields> = {};
    if (invoice.extracted?.totalAmount !== parsedAmount) fields.totalAmount = parsedAmount;
    for (const field of missingKeys) fields[field.key] = (missing[field.key] ?? '').trim();
    try {
      // 1. Save the corrections and confirm the bill with the bill reader.
      //    (Repeating this on a bill that is already confirmed is allowed.)
      await invoiceApi.update(invoice.invoiceId, {
        fields: Object.keys(fields).length > 0 ? fields : undefined,
        category,
        confirm: true,
        updatedBy: user.userId,
      });
      // 2. Claim it: against the chosen advance, or as its own ticket for
      //    approval. Either way the backend reads the amount from the
      //    confirmed bill, so the two can't disagree.
      const ticketId = chosenAdvance
        ? await addBillToAdvance(chosenAdvance.id, invoice.invoiceId)
        : await submitBillForApproval(invoice.invoiceId);
      haptics.success();
      router.replace({ pathname: '/ticket/[id]', params: { id: ticketId } });
    } catch (err) {
      haptics.error();
      const missingFromServer = (err instanceof ApiError ? (err.body as { missingFields?: string[] } | null) : null)
        ?.missingFields;
      setError(
        missingFromServer?.length
          ? `Please fill in the ${missingFromServer.map((field) => FIELD_NAMES[field] ?? field).join(', ')}.`
          : errorMessage(err),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!invoiceApiEnabled) {
    return (
      <Screen title="Upload a bill" backFallback="/home">
        <ErrorState message="Bill upload is not set up yet. Please ask your admin." />
      </Screen>
    );
  }

  return (
    <Screen
      title={fromAdvance ? 'Add a bill' : 'Upload a bill'}
      subtitle={fromAdvance ? `For your advance: ${chosenAdvance?.purpose}` : 'Take a photo of the bill'}
      backFallback="/home"
      footer={
        <PrimaryButton
          label={buttonLabel}
          icon={canSubmit ? 'paper-plane' : undefined}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={isSubmitting}
        />
      }>
      <Step number={1} title="Photo of the bill" done={Boolean(invoice)}>
        {resumeId ? (
          <BillScanStatus scan={scan} onRetry={() => void retry()} />
        ) : (
          <BillPhoto value={bill} onChange={handleBillChange}>
            <BillScanStatus scan={scan} onRetry={() => void retry()} />
          </BillPhoto>
        )}
      </Step>

      {invoice ? (
        <Step number={2} title="Check the amount" done={parsedAmount !== null}>
          <AmountInput
            value={amount}
            onChange={(text) => {
              setAmount(text);
              setFromBill((prev) => ({ ...prev, amount: false }));
            }}
          />
          {fromBill.amount ? <FromBill /> : null}
          {invoice.extracted?.currency && invoice.extracted.currency !== currency.code ? (
            <Text style={styles.warningText}>
              The bill is in {invoice.extracted.currency}, not {currency.code}. Please check the amount.
            </Text>
          ) : null}
        </Step>
      ) : null}

      {invoice ? (
        <Step number={3} title="What was it for?" done={category !== null}>
          <CategoryPicker
            value={category}
            onChange={(next) => {
              setCategory(next);
              setFromBill((prev) => ({ ...prev, category: false }));
            }}
          />
          {fromBill.category ? <FromBill /> : null}
        </Step>
      ) : null}

      {invoice && needsChoice ? (
        <Step number={4} title="Which money did you use?" done={choiceOk}>
          <Text style={styles.hint}>Did you pay with advance cash from the company, or with your own money?</Text>
          {spendable.map((advance) => (
            <MoneyChoice
              key={advance.id}
              selected={paidWith === advance.id}
              icon="wallet"
              title={advance.purpose}
              hint={
                advance.overspent > 0
                  ? `Advance · already overspent by ${formatMoney(advance.overspent)}`
                  : `Advance · ${formatMoney(advance.remaining)} left`
              }
              onPress={() => setPaidWith(advance.id)}
            />
          ))}
          <MoneyChoice
            selected={paidWith === 'own'}
            icon="person"
            title="My own money (claim)"
            hint="You get this money back after approval"
            onPress={() => setPaidWith('own')}
          />
        </Step>
      ) : null}

      {invoice && missingKeys.length > 0 ? (
        <Step number={needsChoice ? 5 : 4} title="Missing details" done={missingOk}>
          <Text style={styles.hint}>We could not read these on the bill. Please type them in.</Text>
          {missingKeys.map((field) => (
            <View key={field.key} style={styles.missingField}>
              <Text style={styles.missingLabel}>{field.label}</Text>
              <TextField
                placeholder={field.placeholder}
                value={missing[field.key] ?? ''}
                onChangeText={(text) => setMissing((prev) => ({ ...prev, [field.key]: text }))}
                keyboardType={field.key === 'invoiceDate' ? 'numbers-and-punctuation' : 'default'}
              />
            </View>
          ))}
        </Step>
      ) : null}

      <InlineError message={error} />
    </Screen>
  );
}

// A big radio-style card for "which money did you use?".
function MoneyChoice({
  selected,
  icon,
  title,
  hint,
  onPress,
}: {
  selected: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <PressableScale
      haptic="select"
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${title}. ${hint}`}
      style={[styles.choice, selected && styles.choiceSelected]}>
      <View style={[styles.choiceIcon, selected && styles.choiceIconSelected]}>
        <Ionicons name={icon} size={22} color={selected ? '#FFFFFF' : colors.primary} />
      </View>
      <View style={styles.choiceText}>
        <Text style={styles.choiceTitle} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.choiceHint}>{hint}</Text>
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={24}
        color={selected ? colors.primary : colors.textMuted}
      />
    </PressableScale>
  );
}

function FromBill() {
  const styles = useStyles();
  const colors = useColors();
  return (
    <View style={styles.fromBill}>
      <Ionicons name="sparkles" size={14} color={colors.success} />
      <Text style={styles.fromBillText}>Filled from your bill. Change it if it is wrong.</Text>
    </View>
  );
}

// What is happening with the bill, in a few plain words.
function BillScanStatus({ scan, onRetry }: { scan: BillScan; onRetry: () => void }) {
  const styles = useStyles();
  const colors = useColors();

  if (scan.state === 'idle') return null;

  if (scan.state === 'sending' || scan.state === 'reading') {
    return (
      <View style={[styles.scanCard, styles.scanInfo]}>
        <ActivityIndicator color={colors.primary} />
        <View style={styles.scanText}>
          <Text style={styles.scanTitle}>{scan.state === 'sending' ? 'Sending your bill…' : 'Reading your bill…'}</Text>
          <Text style={styles.scanHint}>This takes about 30 seconds.</Text>
        </View>
      </View>
    );
  }

  if (scan.state === 'failed') {
    return (
      <View style={[styles.scanCard, styles.scanBad]}>
        <Ionicons name="alert-circle" size={26} color={colors.danger} />
        <View style={styles.scanText}>
          <Text style={styles.scanTitle}>{scan.message}</Text>
          <Text style={styles.scanHint}>Try again, or take a clearer photo.</Text>
          <PressableScale haptic="tap" onPress={onRetry} accessibilityRole="button" style={styles.retry}>
            <Ionicons name="refresh" size={18} color={colors.primary} />
            <Text style={styles.retryText}>Try again</Text>
          </PressableScale>
        </View>
      </View>
    );
  }

  if (scan.state === 'duplicate') {
    return (
      <View style={[styles.scanCard, styles.scanBad]}>
        <Ionicons name="copy" size={26} color={colors.danger} />
        <View style={styles.scanText}>
          <Text style={styles.scanTitle}>This bill was already used</Text>
          <Text style={styles.scanHint}>
            {scan.invoice.duplicateReason === 'SAME_FILE'
              ? 'The same photo was sent before. A bill can be claimed only once.'
              : 'A bill with the same shop and bill number was sent before. A bill can be claimed only once.'}
          </Text>
        </View>
      </View>
    );
  }

  const { invoice } = scan;
  const extracted = invoice.extracted ?? {};
  const rows: [string, string | null | undefined][] = [
    ['Shop', extracted.vendorName],
    ['Date', extracted.invoiceDate ? formatDate(extracted.invoiceDate) : null],
    // In the bill's own currency, which may differ from the app's.
    [
      'Total',
      extracted.totalAmount != null
        ? `${extracted.currency ?? ''} ${extracted.totalAmount.toLocaleString(LOCALE)}`.trim()
        : null,
    ],
    ['Bill no.', extracted.invoiceNumber],
  ];

  return (
    <View style={[styles.scanCard, invoice.needsReview ? styles.scanWarn : styles.scanGood]}>
      <Ionicons
        name={invoice.needsReview ? 'eye' : 'checkmark-circle'}
        size={26}
        color={invoice.needsReview ? colors.warning : colors.success}
      />
      <View style={styles.scanText}>
        <Text style={styles.scanTitle}>{invoice.needsReview ? 'Please check what we read' : 'We read your bill'}</Text>
        {rows
          .filter(([, value]) => value)
          .map(([label, value]) => (
            <View key={label} style={styles.scanRow}>
              <Text style={styles.scanLabel}>{label}</Text>
              <Text style={styles.scanValue} numberOfLines={1}>
                {value}
              </Text>
            </View>
          ))}
        {invoice.possibleDuplicateOf ? (
          <Text style={styles.scanHint}>A bill like this one was sent before. Make sure it is not the same bill.</Text>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.three,
    padding: spacing.four,
    borderRadius: radius.large,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  choiceSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  choiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  choiceIconSelected: {
    backgroundColor: colors.primary,
  },
  choiceText: {
    flex: 1,
    gap: 2,
  },
  choiceTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  choiceHint: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.warning,
  },
  hint: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  missingField: {
    gap: spacing.one,
  },
  missingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  fromBill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.one,
  },
  fromBillText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  scanCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.three,
    padding: spacing.four,
    borderRadius: radius.large,
    borderWidth: 1,
  },
  scanInfo: {
    alignItems: 'center',
    borderColor: colors.borderLight,
    backgroundColor: colors.primarySoft,
  },
  scanGood: {
    borderColor: colors.success,
    backgroundColor: colors.surface,
  },
  scanWarn: {
    borderColor: colors.warning,
    backgroundColor: colors.surface,
  },
  scanBad: {
    borderColor: colors.danger,
    backgroundColor: colors.surface,
  },
  scanText: {
    flex: 1,
    gap: spacing.one,
  },
  scanTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scanHint: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  scanRow: {
    flexDirection: 'row',
    gap: spacing.three,
  },
  scanLabel: {
    width: 64,
    fontSize: 14,
    color: colors.textMuted,
  },
  scanValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.one,
    alignSelf: 'flex-start',
    minHeight: 44,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
  },
}));
