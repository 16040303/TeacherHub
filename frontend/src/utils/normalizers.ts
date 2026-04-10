/**
 * Shared normalizer utilities for runtime-safe data transformation.
 *
 * These helpers centralize common sanitization patterns used across repository
 * and service layers. They are designed to defend against malformed, missing, or
 * partial data that may arrive from a real backend or corrupted local storage.
 */

/* ── String Helpers ────────────────────────────────────────────────── */

/** Trim a string value, returning '' for non-string inputs. */
export const toTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

/** Return a trimmed string or `undefined` when empty/non-string. */
export const toOptionalString = (value: unknown): string | undefined => {
  const normalized = toTrimmedString(value);
  return normalized || undefined;
};

/** Lowercase-trim a string for comparison/search purposes. */
export const toLowerTrimmed = (value?: string): string =>
  (value ?? '').trim().toLowerCase();

/* ── Numeric Helpers ───────────────────────────────────────────────── */

/** Coerce a value to a finite number, returning `fallback` for non-finite inputs. */
export const toSafeNumber = (value: unknown, fallback = 0): number => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

/** Coerce to a non-negative integer. */
export const toNonNegativeInt = (value: unknown, fallback = 0): number => {
  const n = toSafeNumber(value, fallback);
  return Math.max(0, Math.floor(n));
};

/** Coerce to a safe price (non-negative rounded integer). */
export const toSafePrice = (value: unknown): number => {
  const n = toSafeNumber(value);
  return Math.max(0, Math.round(n));
};

/** Coerce to a rating clamped between 0 and 5 with one decimal. */
export const toSafeRating = (value: unknown): number => {
  const n = toSafeNumber(value);
  return Math.max(0, Math.min(5, Number(n.toFixed(1))));
};

/* ── Date / Timestamp Helpers ──────────────────────────────────────── */

/** Parse a date string into a Unix millisecond timestamp, 0 for invalid. */
export const toTimestamp = (value: string): number => {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

/** Normalize an ISO date string, using `fallback` for invalid/missing values. */
export const toSafeDate = (value: unknown, fallback?: string): string => {
  const candidate = toTrimmedString(value);
  if (!candidate) {
    return fallback ?? new Date().toISOString();
  }

  const timestamp = new Date(candidate).getTime();
  if (Number.isNaN(timestamp)) {
    return fallback ?? new Date().toISOString();
  }

  return new Date(timestamp).toISOString();
};

/* ── Enum Helpers ──────────────────────────────────────────────────── */

/**
 * Validate a string value against an explicit allow-list of enum values.
 * Returns `fallback` if the value is not in the list.
 */
export const toSafeEnum = <T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  fallback: T,
): T => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const trimmed = value.trim() as T;
  return allowedValues.includes(trimmed) ? trimmed : fallback;
};

/* ── Array Helpers ─────────────────────────────────────────────────── */

/** Ensure a value is a string array, filtering out non-string elements. */
export const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
};

/* ── URL Helpers ───────────────────────────────────────────────────── */

/** Validate and return a trimmed HTTP(S) URL or `undefined`. */
export const toOptionalHttpUrl = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return trimmed;
    }
  } catch {
    // not a valid URL
  }

  return undefined;
};

/* ── ID Helpers ────────────────────────────────────────────────────── */

/** Ensure an ID is a non-empty trimmed string, using `fallback` otherwise. */
export const toSafeId = (value: unknown, fallback: string): string => {
  const trimmed = toTrimmedString(value);
  return trimmed || fallback;
};
