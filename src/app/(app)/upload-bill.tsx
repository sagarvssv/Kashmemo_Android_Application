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
import {
  type Invoice,
  type InvoiceCategory,
  type InvoiceConfidenceField,
  type InvoiceFields,
  invoiceApi,
  invoiceApiEnabled,
} from '@/lib/invoices';

// Details read from the bill that the user can check and correct before
// sending. The bill reader needs the shop, date and total to confirm a bill;
// the bill number is optional (many small shops don't print one).
type DetailKey = 'vendorName' | 'invoiceNumber' | 'invoiceDate' | 'vendorTaxId' | 'taxAmount';
const DETAIL_FIELDS: {
  key: DetailKey;
  label: string;
  placeholder: string;
  required: boolean;
  keyboard?: 'default' | 'numbers-and-punctuation' | 'decimal-pad';
  autoCapitalize?: 'none' | 'characters' | 'words';
}[] = [
  { key: 'vendorName', label: 'Shop name', placeholder: 'Name of the shop', required: true, autoCapitalize: 'words' },
  { key: 'invoiceNumber', label: 'Bill number', placeholder: 'Optional', required: false, autoCapitalize: 'characters' },
  {
    key: 'invoiceDate',
    label: 'Date on the bill',
    placeholder: 'YYYY-MM-DD, e.g. 2026-10-15',
    required: true,
    keyboard: 'numbers-and-punctuation',
    autoCapitalize: 'none',
  },
  { key: 'vendorTaxId', label: 'Shop tax number (GST)', placeholder: 'Optional', required: false, autoCapitalize: 'characters' },
  { key: 'taxAmount', label: 'Tax amount', placeholder: 'Optional', required: false, keyboard: 'decimal-pad' },
];
const EMPTY_DETAILS: Record<DetailKey, string> = {
  vendorName: '',
  invoiceNumber: '',
  invoiceDate: '',
  vendorTaxId: '',
  taxAmount: '',
};

// What the reader found for a detail, as the text shown in its box.
function readDetail(extracted: Partial<InvoiceFields>, key: DetailKey): string {
  const value = extracted[key];
  if (value == null) return '';
  if (key === 'invoiceDate') return String(value).slice(0, 10);
  return String(value);
}

function isValidDate(text: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;
}

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
  // ?own=1 comes from the Cash request tab: own money, so don't ask who paid.
  const {
    invoiceId: resumeId,
    advanceId,
    own,
  } = useLocalSearchParams<{ invoiceId?: string; advanceId?: string; own?: string }>();
  const ownMoney = own === '1' && !advanceId;
  // Advances whose cash the user collected can take bills (status DISBURSED).
  const wallet = useApi(() => ticketApi.wallet().then((r) => r.data), []);
  const spendable = (wallet.data?.openAdvances ?? []).filter((advance) => advance.status === 'DISBURSED');
  // Which money paid for the bill: an advance's id, or 'own' for the user's own money.
  const [paidWith, setPaidWith] = useState<string | null>(advanceId ?? (ownMoney ? 'own' : null));
  const { scan, start, resume, retry, reset } = useBillScan(user.userId);
  const [bill, setBill] = useState<BillFile | null>(null);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<InvoiceCategory | null>(null);
  const [details, setDetails] = useState<Record<DetailKey, string>>(EMPTY_DETAILS);
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
    setDetails({
      vendorName: readDetail(extracted, 'vendorName'),
      invoiceNumber: readDetail(extracted, 'invoiceNumber'),
      invoiceDate: readDetail(extracted, 'invoiceDate'),
      vendorTaxId: readDetail(extracted, 'vendorTaxId'),
      taxAmount: readDetail(extracted, 'taxAmount'),
    });
    setFromBill(filled);
  }

  const handleBillChange = (next: BillFile | null) => {
    setBill(next);
    setError(null);
    setAmount('');
    setCategory(null);
    setDetails(EMPTY_DETAILS);
    setFromBill({ amount: false, category: false });
    setAppliedInvoiceId(null);
    if (next) void start(next);
    else reset();
  };

  const invoice = scan.state === 'done' ? scan.invoice : null;
  const parsedAmount = parseAmount(amount);
  // The reader flags values it could not read with certainty; they stay
  // highlighted until the user changes them.
  const isUnclear = (key: InvoiceConfidenceField) => invoice?.lowConfidenceFields?.includes(key) ?? false;
  // A problem with each detail the user typed, if any.
  const detailError = (key: DetailKey): string | null => {
    const text = details[key].trim();
    const field = DETAIL_FIELDS.find((f) => f.key === key);
    if (!text) return field?.required ? 'Required' : null;
    if (key === 'invoiceDate' && !isValidDate(text)) return 'Use YYYY-MM-DD, e.g. 2026-10-15';
    if (key === 'taxAmount' && parseAmount(text) === null) return 'Enter a number';
    return null;
  };
  const missingOk = DETAIL_FIELDS.every((field) => detailError(field.key) === null);
  // With open advances the user says which money they used; otherwise it was
  // their own. (An advance that is no longer open can't be chosen.)
  const chosenAdvance = spendable.find((advance) => advance.id === paidWith);
  // Opened from an advance's "Add a bill": that advance paid, so don't ask.
  const fromAdvance = Boolean(advanceId) && chosenAdvance?.id === advanceId;
  const needsChoice = spendable.length > 0 && !fromAdvance && !ownMoney;
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
                ? 'Check the bill details'
                : !choiceOk
                  ? 'Choose which money you used'
                  : !hasDepartment
                    ? 'Ask your admin to add you to a department'
                    : onAdvance
                      ? 'Add to my cash request'
                      : 'Send my bill';

  const handleSubmit = async () => {
    if (!canSubmit || !invoice || parsedAmount === null || !category) return;
    setIsSubmitting(true);
    setError(null);
    const fields: Partial<InvoiceFields> = {};
    if (invoice.extracted?.totalAmount !== parsedAmount) fields.totalAmount = parsedAmount;
    // Send only the details the user changed from what the reader found.
    const extracted = invoice.extracted ?? {};
    for (const field of DETAIL_FIELDS) {
      const text = details[field.key].trim();
      if (text === readDetail(extracted, field.key)) continue;
      if (field.key === 'taxAmount') fields.taxAmount = text ? parseAmount(text) : null;
      else fields[field.key] = text || null;
    }
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
      subtitle={fromAdvance ? `For your cash request: ${chosenAdvance?.purpose}` : 'Take a photo of the bill'}
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
        <Step number={2} title="Check the bill details" done={missingOk}>
          <Text style={styles.hint}>
            {invoice.needsReview || (invoice.missingFields?.length ?? 0) > 0
              ? 'Some details may be wrong or missing. Please check each one and correct it.'
              : 'Check what we read and correct anything that is wrong.'}
          </Text>
          <ReadingNotes invoice={invoice} />
          {DETAIL_FIELDS.map((field) => {
            const problem = detailError(field.key);
            const fromReader = readDetail(invoice.extracted ?? {}, field.key);
            const changed = details[field.key].trim() !== fromReader;
            const unclear = !changed && Boolean(fromReader) && isUnclear(field.key);
            return (
              <View key={field.key} style={styles.missingField}>
                <View style={styles.detailLabelRow}>
                  <Text style={styles.missingLabel}>
                    {field.label}
                    {field.required ? <Text style={styles.requiredMark}> *</Text> : null}
                  </Text>
                  {changed && fromReader ? (
                    <PressableScale
                      haptic="tap"
                      hitSlop={8}
                      accessibilityRole="button"
                      onPress={() => setDetails((prev) => ({ ...prev, [field.key]: fromReader }))}>
                      <Text style={styles.undoText}>Undo</Text>
                    </PressableScale>
                  ) : !fromReader && field.required ? (
                    <Text style={styles.notFound}>Not found on the bill</Text>
                  ) : unclear ? (
                    <Text style={styles.notFound}>Unclear on the bill: please check</Text>
                  ) : null}
                </View>
                <TextField
                  placeholder={field.placeholder}
                  value={details[field.key]}
                  onChangeText={(text) => setDetails((prev) => ({ ...prev, [field.key]: text }))}
                  keyboardType={field.keyboard ?? 'default'}
                  autoCapitalize={field.autoCapitalize}
                  autoCorrect={false}
                  containerStyle={problem ? styles.fieldError : unclear ? styles.fieldUnclear : undefined}
                />
                {problem && (details[field.key].trim() || fromReader) ? <Text style={styles.errorText}>{problem}</Text> : null}
              </View>
            );
          })}
        </Step>
      ) : null}

      {invoice ? (
        <Step number={3} title="Check the amount" done={parsedAmount !== null}>
          <AmountInput
            value={amount}
            onChange={(text) => {
              setAmount(text);
              setFromBill((prev) => ({ ...prev, amount: false }));
            }}
          />
          {fromBill.amount && isUnclear('totalAmount') ? (
            <Text style={styles.warningText}>The total was unclear on the bill. Please check it.</Text>
          ) : fromBill.amount ? (
            <FromBill />
          ) : null}
          {invoice.extracted?.currency && invoice.extracted.currency !== currency.code ? (
            <Text style={styles.warningText}>
              The bill is in {invoice.extracted.currency}, not {currency.code}. Please check the amount.
            </Text>
          ) : null}
        </Step>
      ) : null}

      {invoice ? (
        <Step number={4} title="What was it for?" done={category !== null}>
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
        <Step number={5} title="Which money did you use?" done={choiceOk}>
          <Text style={styles.hint}>Did you pay with cash you requested from the company, or with your own money?</Text>
          {spendable.map((advance) => (
            <MoneyChoice
              key={advance.id}
              selected={paidWith === advance.id}
              icon="wallet"
              title={advance.purpose}
              hint={
                advance.overspent > 0
                  ? `Cash request · already overspent by ${formatMoney(advance.overspent)}`
                  : `Cash request · ${formatMoney(advance.remaining)} left`
              }
              onPress={() => setPaidWith(advance.id)}
            />
          ))}
          <MoneyChoice
            selected={paidWith === 'own'}
            icon="person"
            title="My own money"
            hint="You get this money back after approval"
            onPress={() => setPaidWith('own')}
          />
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

// What the bill reader's checks found: sums that don't add up, a date in the
// future, a handwritten bill. Shown so the user checks those values first.
// Unclear fields are highlighted on their own boxes instead (LOW_CONFIDENCE).
function ReadingNotes({ invoice }: { invoice: Invoice }) {
  const styles = useStyles();
  const colors = useColors();
  const notes = (invoice.validationWarnings ?? [])
    .filter((warning) => warning.code !== 'LOW_CONFIDENCE')
    .map((warning) => warning.message);
  if (invoice.isHandwritten) notes.unshift('This bill is handwritten. Check the numbers carefully.');
  if (notes.length === 0) return null;
  return (
    <View style={styles.notes}>
      <View style={styles.notesHeader}>
        <Ionicons name="alert-circle" size={18} color={colors.warning} />
        <Text style={styles.notesTitle}>Please check</Text>
      </View>
      {notes.map((note, index) => (
        <Text key={index} style={styles.noteText}>
          • {note}
        </Text>
      ))}
    </View>
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
              ? 'The same photo was sent before. A bill can be used only once.'
              : 'A bill with the same shop and bill number was sent before. A bill can be used only once.'}
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
  detailLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.two,
  },
  requiredMark: {
    color: colors.danger,
  },
  undoText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  notFound: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.warning,
  },
  fieldError: {
    borderColor: colors.danger,
  },
  fieldUnclear: {
    borderColor: colors.warning,
  },
  notes: {
    gap: spacing.one,
    padding: spacing.three,
    borderRadius: radius.medium,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: `${colors.warning}14`,
  },
  notesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.one,
  },
  notesTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  noteText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
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
