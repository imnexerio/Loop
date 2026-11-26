/**
 * Shared PIN rules. The lock screen, the setup/change/remove modal and
 * PinContext all read from here so they can never disagree on what a
 * valid PIN looks like.
 *
 * PINs are stored as a hash of the digit string, so PINs set before
 * variable lengths existed (always 4 digits) keep working unchanged.
 */
export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 8

export function isValidPin(pin: string): boolean {
  return /^\d+$/.test(pin) && pin.length >= PIN_MIN_LENGTH && pin.length <= PIN_MAX_LENGTH
}

export const PIN_LENGTH_HINT = `${PIN_MIN_LENGTH}–${PIN_MAX_LENGTH} digits`

/**
 * Whether an Enter keypress should submit the PIN.
 *
 * Enter on a button inside the PIN screen that isn't part of the keypad
 * (Close, Forgot PIN?) keeps its normal behaviour. Everywhere else it
 * submits - including a focused keypad digit (so Enter doesn't press
 * that digit again) and a button behind the dialog, such as the
 * "Change" button that opened it and still has focus.
 *
 * The PIN screen's root is marked with `data-pin-dialog` and the keypad
 * with `data-pin-keypad`. Callers should preventDefault() when this
 * returns true, so the focused button isn't also clicked.
 */
export function shouldEnterSubmitPin(e: KeyboardEvent): boolean {
  const target = e.target instanceof Element ? e.target : null
  const button = target?.closest('button')
  if (button && button.closest('[data-pin-dialog]') && !button.closest('[data-pin-keypad]')) {
    return false
  }
  return true
}
