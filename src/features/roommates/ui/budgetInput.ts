import { formatMoneyInput } from "../../../shared/lib/format.ts";

export type BudgetInputState = {
  raw: string;
  display: string;
  selectionStart: number;
  selectionEnd: number;
};

export const emptyBudgetInput = (): BudgetInputState => ({
  raw: "", display: "", selectionStart: 0, selectionEnd: 0,
});

const digitsOnly = (value: string) => value.replace(/\D/g, "");

/** Locate a logical digit boundary in the formatted string (never a fixed offset). */
function digitBoundary(display: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < display.length; index++) {
    if (/\d/.test(display[index]) && ++seen === count) return index + 1;
  }
  return display.length;
}

/** Map the browser's post-edit value/selection to canonical digits and presentation. */
export function editBudgetInput(
  previous: Pick<BudgetInputState, "raw" | "display">,
  edit: { value: string; selectionStart: number; selectionEnd: number; inputType?: string },
): BudgetInputState {
  let digits = digitsOnly(edit.value);
  let startDigits = digitsOnly(edit.value.slice(0, edit.selectionStart)).length;
  let endDigits = digitsOnly(edit.value.slice(0, edit.selectionEnd)).length;

  // The browser removed only a grouping dot. Skip it and delete the adjacent digit.
  if (
    digits === previous.raw && edit.value !== previous.display &&
    (edit.inputType === "deleteContentBackward" || edit.inputType === "deleteContentForward")
  ) {
    const index = edit.inputType === "deleteContentBackward" ? startDigits - 1 : startDigits;
    if (index >= 0 && index < digits.length) {
      digits = digits.slice(0, index) + digits.slice(index + 1);
      if (index < startDigits) startDigits--;
      if (index < endDigits) endDigits--;
    }
  }

  // Normalize leading zeros without converting to Number or losing large integers.
  const raw = digits.replace(/^0+(?=\d)/, "");
  const removedZeros = digits.length - raw.length;
  const display = formatMoneyInput(raw);
  return {
    raw,
    display,
    selectionStart: digitBoundary(display, startDigits - removedZeros),
    selectionEnd: digitBoundary(display, endDigits - removedZeros),
  };
}
