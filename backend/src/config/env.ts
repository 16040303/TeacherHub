import "dotenv/config";

type NodeEnv = "development" | "test" | "production";

const toTrimmedString = (value: string | undefined): string =>
  typeof value === "string" ? value.trim() : "";

const parseNodeEnv = (value: string | undefined): NodeEnv => {
  const normalized = toTrimmedString(value).toLowerCase();

  if (!normalized) {
    return "development";
  }

  if (
    normalized === "development" ||
    normalized === "test" ||
    normalized === "production"
  ) {
    return normalized;
  }

  throw new Error("Invalid NODE_ENV. Use development, test, or production.");
};

const requireValue = (value: string | undefined, name: string): string => {
  const normalized = toTrimmedString(value);

  if (!normalized) {
    throw new Error(`${name} is required.`);
  }

  return normalized;
};

const parseInteger = (
  value: string | undefined,
  name: string,
  fallback: number,
  options?: { min?: number; max?: number }
): number => {
  const normalized = toTrimmedString(value);

  if (!normalized) {
    return fallback;
  }

  const parsed = Number(normalized);

  if (!Number.isInteger(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }

  if (typeof options?.min === "number" && parsed < options.min) {
    throw new Error(`${name} must be >= ${options.min}.`);
  }

  if (typeof options?.max === "number" && parsed > options.max) {
    throw new Error(`${name} must be <= ${options.max}.`);
  }

  return parsed;
};

const parseBoolean = (
  value: string | undefined,
  name: string,
  fallback: boolean
): boolean => {
  const normalized = toTrimmedString(value).toLowerCase();

  if (!normalized) {
    return fallback;
  }

  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new Error(`${name} must be a boolean value (true/false).`);
};

const parseDelimitedList = (value: string | undefined): string[] => {
  const normalized = toTrimmedString(value);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

const validateDatabaseUrl = (value: string): string => {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid URL.");
  }

  if (!["mysql:", "mariadb:"].includes(parsedUrl.protocol)) {
    throw new Error("DATABASE_URL must use mysql:// or mariadb:// protocol.");
  }

  return value;
};

const validateJwtSecret = (value: string): string => {
  const weakSecrets = new Set([
    "super_secret_key",
    "changeme",
    "change-me",
    "password",
    "secret",
    "default",
    "123456",
  ]);

  if (value.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }

  if (weakSecrets.has(value.toLowerCase())) {
    throw new Error("JWT_SECRET uses a known weak default. Set a stronger value.");
  }

  return value;
};

const parseBodySize = (value: string | undefined, fallback: string): string => {
  const normalized = toTrimmedString(value);
  return normalized || fallback;
};

const parseHttpUrl = (value: string, name: string): string => {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${name} must use http:// or https:// protocol.`);
  }

  return value;
};

const parseOptionalHttpUrl = (value: string | undefined, name: string): string => {
  const normalized = toTrimmedString(value);
  if (!normalized) {
    return "";
  }

  return parseHttpUrl(normalized, name);
};

const nodeEnv = parseNodeEnv(process.env.NODE_ENV);

const defaultCorsOrigins = [
  "http://localhost:1604",
  "http://127.0.0.1:1604",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const configuredOrigins = parseDelimitedList(process.env.CORS_ALLOWED_ORIGINS);

if (nodeEnv === "production" && configuredOrigins.length === 0) {
  throw new Error(
    "CORS_ALLOWED_ORIGINS is required in production and must list trusted origins."
  );
}

const corsAllowedOrigins =
  configuredOrigins.length > 0 ? configuredOrigins : defaultCorsOrigins;

const port = parseInteger(process.env.PORT, "PORT", 3000, {
  min: 1,
  max: 65535,
});

const frontendUrl = parseHttpUrl(
  requireValue(process.env.FRONTEND_URL, "FRONTEND_URL"),
  "FRONTEND_URL"
);

const configuredVnpayTmnCode = toTrimmedString(process.env.VNPAY_TMN_CODE);
const configuredVnpayHashSecret = toTrimmedString(process.env.VNPAY_HASH_SECRET);
const configuredVnpayUrl = parseOptionalHttpUrl(process.env.VNPAY_URL, "VNPAY_URL");
const configuredVnpayReturnUrl = parseOptionalHttpUrl(
  process.env.VNPAY_RETURN_URL,
  "VNPAY_RETURN_URL"
);
const configuredVnpayIpnUrl = parseOptionalHttpUrl(
  process.env.VNPAY_IPN_URL,
  "VNPAY_IPN_URL"
);

const fallbackVnpayUrl = "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html";
const fallbackVnpayReturnUrl = `${frontendUrl.replace(/\/$/, "")}/wallet`;
const fallbackVnpayIpnUrl = `http://localhost:${port}/api/wallet/topup/vnpay/ipn`;

export const env = {
  NODE_ENV: nodeEnv,
  IS_PRODUCTION: nodeEnv === "production",
  PORT: port,
  DATABASE_URL: validateDatabaseUrl(
    requireValue(process.env.DATABASE_URL, "DATABASE_URL")
  ),
  JWT_SECRET: validateJwtSecret(
    requireValue(process.env.JWT_SECRET, "JWT_SECRET")
  ),
  ACCESS_TOKEN_EXPIRES_IN:
    toTrimmedString(process.env.ACCESS_TOKEN_EXPIRES_IN) || "15m",
  REFRESH_TOKEN_EXPIRES_IN:
    toTrimmedString(process.env.REFRESH_TOKEN_EXPIRES_IN) || "7d",
  CORS_ALLOWED_ORIGINS: corsAllowedOrigins,
  TRUST_PROXY: parseBoolean(process.env.TRUST_PROXY, "TRUST_PROXY", false),
  MAX_JSON_BODY_SIZE: parseBodySize(process.env.MAX_JSON_BODY_SIZE, "1mb"),
  MAX_URLENCODED_BODY_SIZE: parseBodySize(
    process.env.MAX_URLENCODED_BODY_SIZE,
    "1mb"
  ),
  AUTH_RATE_LIMIT_WINDOW_MS: parseInteger(
    process.env.AUTH_RATE_LIMIT_WINDOW_MS,
    "AUTH_RATE_LIMIT_WINDOW_MS",
    15 * 60 * 1000,
    { min: 1000 }
  ),
  AUTH_RATE_LIMIT_MAX: parseInteger(
    process.env.AUTH_RATE_LIMIT_MAX,
    "AUTH_RATE_LIMIT_MAX",
    20,
    { min: 1 }
  ),
  UPLOADS_PUBLIC_ENABLED: parseBoolean(
    process.env.UPLOADS_PUBLIC_ENABLED,
    "UPLOADS_PUBLIC_ENABLED",
    nodeEnv !== "production"
  ),
  FRONTEND_URL: frontendUrl,
  GOOGLE_CLIENT_ID: requireValue(process.env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_ID"),
  SMTP_HOST: toTrimmedString(process.env.SMTP_HOST),
  SMTP_PORT: parseInteger(process.env.SMTP_PORT, "SMTP_PORT", 587, {
    min: 1,
    max: 65535,
  }),
  SMTP_USER: toTrimmedString(process.env.SMTP_USER),
  SMTP_PASS: toTrimmedString(process.env.SMTP_PASS),
  SMTP_FROM: toTrimmedString(process.env.SMTP_FROM) || "noreply@teacherhub.local",
  VNPAY_TMN_CODE: configuredVnpayTmnCode || "DEMOTMN",
  VNPAY_HASH_SECRET: configuredVnpayHashSecret || "DEMO_HASH_SECRET",
  VNPAY_URL: configuredVnpayUrl || fallbackVnpayUrl,
  VNPAY_RETURN_URL: configuredVnpayReturnUrl || fallbackVnpayReturnUrl,
  VNPAY_IPN_URL: configuredVnpayIpnUrl || fallbackVnpayIpnUrl,
} as const;

if (env.IS_PRODUCTION) {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    throw new Error(
      "SMTP_HOST, SMTP_USER, and SMTP_PASS are required in production."
    );
  }

  if (
    !configuredVnpayTmnCode ||
    !configuredVnpayHashSecret ||
    !configuredVnpayUrl ||
    !configuredVnpayReturnUrl ||
    !configuredVnpayIpnUrl
  ) {
    throw new Error(
      "VNPAY_TMN_CODE, VNPAY_HASH_SECRET, VNPAY_URL, VNPAY_RETURN_URL, and VNPAY_IPN_URL are required in production."
    );
  }
}
