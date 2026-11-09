import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { DEFAULT_CURRENCY, findCurrency, type Currency } from '@/lib/currencies';
import { formatMoney } from '@/lib/format';
import { readCurrency, writeCurrency } from '@/lib/storage';
import type { Money } from '@/lib/types';

type CurrencyContextValue = {
  currency: Currency;
  setCurrency: (code: string) => void;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

// Display currency only: amounts from the backend are shown as-is, not converted.
export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [code, setCode] = useState(DEFAULT_CURRENCY);

  useEffect(() => {
    let cancelled = false;
    readCurrency()
      .then((saved) => {
        if (!cancelled && findCurrency(saved)) setCode(saved as string);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const setCurrency = useCallback((next: string) => {
    if (!findCurrency(next)) return;
    setCode(next);
    void writeCurrency(next).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ currency: findCurrency(code) ?? findCurrency(DEFAULT_CURRENCY)!, setCurrency }),
    [code, setCurrency],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used inside CurrencyProvider');
  return context;
}

// Formats an amount in the currency picked in Profile.
export function useFormatMoney() {
  const { currency } = useCurrency();
  return useCallback((value: Money | null | undefined) => formatMoney(value, currency.code), [currency.code]);
}
