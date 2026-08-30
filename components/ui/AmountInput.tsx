"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * A money field that groups thousands as you type — 4500 reads back as "4,500",
 * the same way every rent is already printed around the app.
 *
 * `<input type="number">` cannot do this: browsers reject a comma as invalid
 * input and render no separators of their own. So the visible field is plain
 * text (`inputMode="numeric"` still gets the numeric keypad on a phone) and a
 * hidden sibling carries the bare digits under `name`, which keeps every
 * consumer — server actions, the filter query string — reading exactly the
 * plain number they read before.
 *
 * Grouping is done by hand rather than with `toLocaleString`, whose separator
 * follows the visitor's locale: a browser set to de-DE would write "4.500" and
 * a German visitor would be told their rent is four and a half shekels.
 */
const group = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const digitsOf = (text: string) => text.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

type Props = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "defaultValue" | "onChange" | "inputMode"
> & {
  name: string;
  defaultValue?: string | number | null;
};

export function AmountInput({ name, defaultValue = "", ...rest }: Props) {
  const [digits, setDigits] = useState(() => digitsOf(String(defaultValue ?? "")));
  const ref = useRef<HTMLInputElement>(null);
  // Where the caret should sit once React has painted the re-grouped text.
  const caret = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (caret.current === null || !ref.current) return;
    ref.current.setSelectionRange(caret.current, caret.current);
    caret.current = null;
  });

  // Typing a digit mid-number can push a comma in ahead of the caret, which
  // would otherwise drift left by one per separator. So the caret is remembered
  // as "how many digits are to my left" — a count commas cannot disturb — and
  // put back at that same digit in the regrouped text.
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const digitsBeforeCaret = el.value.slice(0, el.selectionStart ?? 0).replace(/\D/g, "").length;
    const next = digitsOf(el.value);
    setDigits(next);

    const text = group(next);
    let seen = 0;
    let pos = digitsBeforeCaret === 0 ? 0 : text.length;
    for (let i = 0; i < text.length && digitsBeforeCaret > 0; i++) {
      if (text[i] !== ",") seen++;
      if (seen === digitsBeforeCaret) {
        pos = i + 1;
        break;
      }
    }
    caret.current = pos;
  };

  return (
    <>
      <input {...rest} ref={ref} type="text" inputMode="numeric" value={group(digits)} onChange={onChange} />
      <input type="hidden" name={name} value={digits} />
    </>
  );
}
