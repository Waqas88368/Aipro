/**
 * User state machine.
 *
 * The core fix for "login succeeded ≠ data extraction succeeded":
 * AUTHENTICATED is only the entry of the extraction chain; READY is reached
 * only after EXTRACTING_DATA → DATA_VALIDATED → DATA_SAVED.
 */

export const USER_STATES = [
  "NEW",
  "LANGUAGE_SET",
  "AWAITING_EMAIL",
  "AWAITING_PASSWORD",
  "AUTHENTICATING",
  "AUTHENTICATED",
  "EXTRACTING_DATA",
  "DATA_VALIDATED",
  "DATA_SAVED",
  "READY",
  "AUTH_FAILED",
  "EXTRACTION_FAILED",
  "VALIDATION_FAILED",
] as const;

export type UserState = (typeof USER_STATES)[number];

/** The happy extraction chain — displayed in <state> tags in the UI. */
export const AUTH_CHAIN: readonly UserState[] = [
  "AUTHENTICATED",
  "EXTRACTING_DATA",
  "DATA_VALIDATED",
  "DATA_SAVED",
  "READY",
];

export const BUSY_STATES: ReadonlySet<UserState> = new Set([
  "AUTHENTICATING",
  "EXTRACTING_DATA",
]);

export function isReadinessState(state: UserState): boolean {
  return state === "READY";
}
