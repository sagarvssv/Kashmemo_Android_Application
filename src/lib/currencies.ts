export type Currency = {
  code: string;
  name: string;
  country: string;
  flag: string;
  // Locale used for digit grouping and symbol placement, e.g. 1,00,000 for INR.
  locale: string;
};

export const DEFAULT_CURRENCY = 'AED';

export const CURRENCIES: Currency[] = [
  { code: 'AED', name: 'UAE Dirham', country: 'United Arab Emirates', flag: '🇦🇪', locale: 'en-AE' },
  { code: 'SAR', name: 'Saudi Riyal', country: 'Saudi Arabia', flag: '🇸🇦', locale: 'en-SA' },
  { code: 'QAR', name: 'Qatari Riyal', country: 'Qatar', flag: '🇶🇦', locale: 'en-QA' },
  { code: 'KWD', name: 'Kuwaiti Dinar', country: 'Kuwait', flag: '🇰🇼', locale: 'en-KW' },
  { code: 'BHD', name: 'Bahraini Dinar', country: 'Bahrain', flag: '🇧🇭', locale: 'en-BH' },
  { code: 'OMR', name: 'Omani Rial', country: 'Oman', flag: '🇴🇲', locale: 'en-OM' },
  { code: 'INR', name: 'Indian Rupee', country: 'India', flag: '🇮🇳', locale: 'en-IN' },
  { code: 'PKR', name: 'Pakistani Rupee', country: 'Pakistan', flag: '🇵🇰', locale: 'en-PK' },
  { code: 'BDT', name: 'Bangladeshi Taka', country: 'Bangladesh', flag: '🇧🇩', locale: 'en-BD' },
  { code: 'LKR', name: 'Sri Lankan Rupee', country: 'Sri Lanka', flag: '🇱🇰', locale: 'en-LK' },
  { code: 'NPR', name: 'Nepalese Rupee', country: 'Nepal', flag: '🇳🇵', locale: 'en-NP' },
  { code: 'PHP', name: 'Philippine Peso', country: 'Philippines', flag: '🇵🇭', locale: 'en-PH' },
  { code: 'EGP', name: 'Egyptian Pound', country: 'Egypt', flag: '🇪🇬', locale: 'en-EG' },
  { code: 'USD', name: 'US Dollar', country: 'United States', flag: '🇺🇸', locale: 'en-US' },
  { code: 'EUR', name: 'Euro', country: 'European Union', flag: '🇪🇺', locale: 'en-IE' },
  { code: 'GBP', name: 'British Pound', country: 'United Kingdom', flag: '🇬🇧', locale: 'en-GB' },
  { code: 'CHF', name: 'Swiss Franc', country: 'Switzerland', flag: '🇨🇭', locale: 'en-CH' },
  { code: 'CAD', name: 'Canadian Dollar', country: 'Canada', flag: '🇨🇦', locale: 'en-CA' },
  { code: 'AUD', name: 'Australian Dollar', country: 'Australia', flag: '🇦🇺', locale: 'en-AU' },
  { code: 'NZD', name: 'New Zealand Dollar', country: 'New Zealand', flag: '🇳🇿', locale: 'en-NZ' },
  { code: 'SGD', name: 'Singapore Dollar', country: 'Singapore', flag: '🇸🇬', locale: 'en-SG' },
  { code: 'MYR', name: 'Malaysian Ringgit', country: 'Malaysia', flag: '🇲🇾', locale: 'en-MY' },
  { code: 'IDR', name: 'Indonesian Rupiah', country: 'Indonesia', flag: '🇮🇩', locale: 'en-ID' },
  { code: 'THB', name: 'Thai Baht', country: 'Thailand', flag: '🇹🇭', locale: 'en-TH' },
  { code: 'JPY', name: 'Japanese Yen', country: 'Japan', flag: '🇯🇵', locale: 'en-JP' },
  { code: 'CNY', name: 'Chinese Yuan', country: 'China', flag: '🇨🇳', locale: 'en-CN' },
  { code: 'HKD', name: 'Hong Kong Dollar', country: 'Hong Kong', flag: '🇭🇰', locale: 'en-HK' },
  { code: 'KRW', name: 'South Korean Won', country: 'South Korea', flag: '🇰🇷', locale: 'en-KR' },
  { code: 'ZAR', name: 'South African Rand', country: 'South Africa', flag: '🇿🇦', locale: 'en-ZA' },
  { code: 'NGN', name: 'Nigerian Naira', country: 'Nigeria', flag: '🇳🇬', locale: 'en-NG' },
  { code: 'KES', name: 'Kenyan Shilling', country: 'Kenya', flag: '🇰🇪', locale: 'en-KE' },
  { code: 'TRY', name: 'Turkish Lira', country: 'Turkey', flag: '🇹🇷', locale: 'en-TR' },
  { code: 'BRL', name: 'Brazilian Real', country: 'Brazil', flag: '🇧🇷', locale: 'en-BR' },
  { code: 'MXN', name: 'Mexican Peso', country: 'Mexico', flag: '🇲🇽', locale: 'en-MX' },
];

export function findCurrency(code: string | null | undefined): Currency | undefined {
  return CURRENCIES.find((currency) => currency.code === code);
}
