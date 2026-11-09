import { router } from 'expo-router';
import React, { useState } from 'react';

import { AmountInput, CategoryPicker, NoteInput, parseAmount, Step } from '@/components/form-steps';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { InlineError } from '@/components/states';
import { errorMessage } from '@/lib/api';
import { ticketApi } from '@/lib/endpoints';
import { haptics } from '@/lib/haptics';
import type { InvoiceCategory } from '@/lib/invoices';

// Requesting an advance: asking for cash before spending it, so there is no
// bill yet. (Money already spent is claimed back on the Upload a bill screen.)
// Two numbered steps with big targets and few words: how much, what for.
export default function RaiseTicketScreen() {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<InvoiceCategory | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedAmount = parseAmount(amount);
  // "Other" needs a few words so approvers know what it is for.
  const purpose = [category && category !== 'Miscellaneous' ? category : null, note.trim() || null]
    .filter(Boolean)
    .join(' – ');
  const purposeOk = purpose.length >= 3;
  const canSubmit = parsedAmount !== null && purposeOk && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const { data } = await ticketApi.raise(purpose, parsedAmount);
      haptics.success();
      router.replace({ pathname: '/ticket/[id]', params: { id: data.id } });
    } catch (err) {
      haptics.error();
      setError(errorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Screen
      title="Request an advance"
      subtitle="Get cash before you spend it. Add the bills later."
      backFallback="/tickets"
      footer={
        <PrimaryButton
          label={canSubmit ? 'Send' : parsedAmount === null ? 'Enter the amount' : 'Choose what it is for'}
          icon={canSubmit ? 'paper-plane' : undefined}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={isSubmitting}
        />
      }>
      <Step number={1} title="How much do you need?" done={parsedAmount !== null}>
        <AmountInput value={amount} onChange={setAmount} />
      </Step>

      <Step number={2} title="What is it for?" done={purposeOk}>
        <CategoryPicker value={category} onChange={setCategory} />
        <NoteInput
          value={note}
          onChange={setNote}
          placeholder={category === 'Miscellaneous' ? 'Write what you will buy' : 'Add a note (optional)'}
        />
      </Step>

      <InlineError message={error} />
    </Screen>
  );
}
