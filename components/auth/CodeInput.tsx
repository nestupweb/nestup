"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from "react";

export const CODE_LENGTH = 6;

/**
 * Six boxes for the confirmation code. The real value is a single hidden input
 * named `code`, so the form submits one string and the server never has to
 * reassemble digits.
 *
 * The behaviours that make one of these bearable to use, all of which have to
 * be written by hand:
 *  - typing moves forward, Backspace on an empty box moves back;
 *  - pasting the whole code into any box fills all six (people paste far more
 *    often than they type, and a paste that only fills one box feels broken);
 *  - `inputMode="numeric"` + `autoComplete="one-time-code"` so phones show the
 *    number pad and iOS offers the code straight from the message;
 *  - the six boxes are one labelled group to a screen reader, not six unlabelled
 *    text fields.
 */
export function CodeInput({
  onComplete,
  disabled,
  invalid,
}: {
  /** Fired once six digits are present — used to submit without a click. */
  onComplete?: (code: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const code = digits.join("");

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (code.length === CODE_LENGTH) onComplete?.(code);
    // onComplete is recreated each render by callers; the code is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  function put(index: number, value: string) {
    const only = value.replace(/\D/g, "");
    if (!only) return;
    setDigits((prev) => {
      const next = [...prev];
      // A paste (or a fast typist) can deliver more than one digit at once.
      for (let i = 0; i < only.length && index + i < CODE_LENGTH; i++) {
        next[index + i] = only[i];
      }
      return next;
    });
    const landed = Math.min(index + only.length, CODE_LENGTH - 1);
    refs.current[landed]?.focus();
    refs.current[landed]?.select();
  }

  function onKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      setDigits((prev) => {
        const next = [...prev];
        if (next[index]) next[index] = "";
        else if (index > 0) {
          next[index - 1] = "";
          refs.current[index - 1]?.focus();
        }
        return next;
      });
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < CODE_LENGTH - 1) refs.current[index + 1]?.focus();
  }

  function onPaste(index: number, e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    put(index, e.clipboardData.getData("text"));
  }

  return (
    <div role="group" aria-label={`Confirmation code, ${CODE_LENGTH} digits`}>
      <input type="hidden" name="code" value={code} />
      <div className="flex justify-center gap-2 sm:gap-2.5">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={digit}
            onChange={(e) => put(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            onPaste={(e) => onPaste(i, e)}
            onFocus={(e) => e.target.select()}
            disabled={disabled}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={CODE_LENGTH}
            aria-label={`Digit ${i + 1}`}
            aria-invalid={invalid || undefined}
            className={`h-14 w-11 rounded-xl border bg-paper text-center text-2xl font-semibold text-ink outline-none transition-colors sm:h-16 sm:w-12 ${
              invalid
                ? "border-danger focus:border-danger"
                : digit
                  ? "border-accent"
                  : "border-hairline focus:border-accent"
            } disabled:opacity-60`}
          />
        ))}
      </div>
    </div>
  );
}
