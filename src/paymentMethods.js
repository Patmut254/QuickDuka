// Single source of truth for the payment methods offered on Sales, Credit
// payments and Supplier payments. Keys are what get stored on the record;
// labels come from t.paymentMethods[key] in LangContext.
//
// "mpesa" is kept as a generic option so older records (and anyone who just
// wants "M-Pesa" without the detail) keep working.
export const PAYMENT_METHODS = [
  "cash",
  "mpesa", // generic M-Pesa (legacy / unspecified)
  "till", // Safaricom Till Number (Lipa na M-Pesa / Buy Goods)
  "paybill", // Paybill — bank or business paybill
  "pochi", // M-Pesa Pochi la Biashara
  "send_money", // M-Pesa Send Money (person to person)
  "airtel",
  "card",
];

// Helper for <select> options in EntryTable (inline edit): [{value, label}]
export const paymentMethodOptions = (t) =>
  PAYMENT_METHODS.map((m) => ({ value: m, label: t.paymentMethods?.[m] || m }));
