// Shared helper: stock items -> SearchSelect options.
export function stockOptions(stock, { valueKey = "id", labelFn, priceKey = "price", t = {}, disableOut = false } = {}) {
  return stock.map((c) => {
    const out = disableOut && c.quantity != null && Number(c.quantity) <= 0;
    const price =
      c[priceKey] != null
        ? `KES ${Number(c[priceKey]).toLocaleString()}${c.unit ? ` / ${c.unit}` : ""}`
        : "";
    const qty =
      c.quantity != null ? `${Number(c.quantity).toLocaleString()} ${t.qtyInStoreShort || "in store"}` : "";
    return {
      value: c[valueKey],
      label: labelFn ? labelFn(c) : c.name,
      hint: out ? t.outOfStock || "Out of stock" : [price, qty].filter(Boolean).join(" · "),
      disabled: out,
    };
  });
}
