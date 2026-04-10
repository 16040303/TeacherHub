/**
 * Canonical frontend-consumable error shape.
 */
export interface AppError {
  message: string;
  statusCode?: number;
  validationErrors?: Record<string, string[]>;
  raw?: unknown;
}

export const isAppError = (error: unknown): error is AppError => {
  return typeof error === 'object' && error !== null && 'message' in error;
};

/**
 * Parses generic caught errors, Fetch API errors, or Axios errors into a standardized `AppError`.
 * Safely processes `{ message: string, errors?: { ... } }` sent by the TeacherHub backend.
 */
export const parseApiError = (error: unknown): AppError => {
  // If it's already properly shaped (or we generated it locally)
  if (isAppError(error) && error.message) {
    return {
      message: error.message,
      statusCode: (error as any).statusCode || (error as any).status,
      validationErrors: (error as any).validationErrors || (error as any).errors,
      raw: error,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      raw: error,
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
      raw: error,
    };
  }

  // Fallback
  return {
    message: 'An unknown error occurred.',
    raw: error,
  };
};

/**
 * Throw a parsed API error.
 */
export const throwParsedError = (error: unknown): never => {
  throw parseApiError(error);
};
