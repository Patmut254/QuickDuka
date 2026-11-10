// Helpers for BatchRows (multi-entry Expenses / Losses / Purchases)
let _seq = 0;
export const newBatchRow = (init = {}) => ({
  key: `r${Date.now()}_${_seq++}`,
  ...init,
});

// Rows with something typed in them (blank extra rows are ignored on save)
export const usedRows = (rows, fields) =>
  rows.filter((r) =>
    fields.some(
      (f) => f.type !== "select" && String(r[f.key] ?? "").trim() !== "",
    ),
  );

// Shared id that ties entries saved together (shown grouped in the table)
export const newBatchId = () =>
  `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
