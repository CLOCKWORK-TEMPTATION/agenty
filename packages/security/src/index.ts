import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { PermissionMatrix, RbacRole, SecurityContext } from "@repo/types";

export const defaultPermissions: PermissionMatrix[] = [
  { action: "team:write", roles: ["owner", "admin", "operator"] },
  { action: "team:read", roles: ["owner", "admin", "operator", "viewer"] },
  { action: "tool:approve", roles: ["owner", "admin"] },
  { action: "mcp:manage", roles: ["owner", "admin"] }
];

export const can = (context: SecurityContext, action: string): boolean => {
  const permission = defaultPermissions.find((item) => item.action === action);
  if (!permission) {
    return false;
  }
  return context.roles.some((role) => permission.roles.includes(role));
};

export const requireRole = (context: SecurityContext, roles: RbacRole[]): void => {
  if (!context.roles.some((role) => roles.includes(role))) {
    throw new Error("forbidden");
  }
};

const secret = (process.env.APP_ENCRYPTION_KEY ?? "local-dev-secret").padEnd(32, "0").slice(0, 32);
const key = scryptSync(secret, "salt", 32);

export const encryptValue = (plainText: string): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
};

export const decryptValue = (encoded: string): string => {
  const payload = Buffer.from(encoded, "base64");
  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return plain.toString("utf-8");
};

const piiPatterns: RegExp[] = [
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b(?:\d[ -]*?){13,16}\b/g,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
];

export const sanitizeForDlp = (text: string): string => {
  return piiPatterns.reduce((value, pattern) => value.replace(pattern, "[REDACTED]"), text);
};

interface RateBucket {
  count: number;
  resetAt: number;
}

const ONE_MINUTE_MS = 60_000;
const MAX_REQUESTS_PER_MINUTE = 300;

const _securityPluginImpl = async (app: FastifyInstance): Promise<void> => {
  const buckets = new Map<string, RateBucket>();

  app.addHook("onRequest", async (request, reply) => {
    const key = request.ip;
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + ONE_MINUTE_MS });
      return;
    }

    existing.count += 1;
    if (existing.count > MAX_REQUESTS_PER_MINUTE) {
      reply.code(429).send({
        error_code: "rate_limited",
        message: "Too many requests",
        retryable: true,
        trace_id: `rate_${now}`
      });
    }
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("x-frame-options", "DENY");
    reply.header("referrer-policy", "strict-origin-when-cross-origin");
    reply.header("x-xss-protection", "1; mode=block");
    return payload;
  });
};

/**
 * Break Fastify's plugin encapsulation so that the rate-limit and
 * security-header hooks apply to ALL routes regardless of where they are
 * registered.  This is exactly what `fastify-plugin` does internally via the
 * `[Symbol.for('skip-override')]` property.
 */
(_securityPluginImpl as unknown as Record<symbol, boolean>)[Symbol.for("skip-override")] = true;

export const securityPlugin = _securityPluginImpl;

// ---------------------------------------------------------------------------
// Prompt Injection Detection
// ---------------------------------------------------------------------------

interface PromptInjectionResult {
  detected: boolean;
  patterns: string[];
}

/**
 * Normalise a string for injection matching: collapse unicode homoglyphs,
 * remove zero-width characters, and lower-case.
 */
const normaliseForInjectionCheck = (input: string): string => {
  // Remove zero-width / invisible unicode characters
  const stripped = input.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "");
  // Normalize to NFC so composed/decomposed forms compare equally
  return stripped.normalize("NFC").toLowerCase();
};

/**
 * Return true when `encoded` is a valid base64 string whose decoded text
 * contains at least one prompt-injection indicator phrase.
 */
const containsBase64InjectionPayload = (encoded: string): boolean => {
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf-8");
    // Only treat it as a potential injection if the decoded string looks like
    // meaningful text (contains at least one space word boundary).
    if (!/\s/.test(decoded)) {
      return false;
    }
    const lower = decoded.toLowerCase();
    return (
      lower.includes("ignore") ||
      lower.includes("system prompt") ||
      lower.includes("you are now") ||
      lower.includes("act as") ||
      lower.includes("forget") ||
      lower.includes("disregard") ||
      lower.includes("previous instructions")
    );
  } catch {
    return false;
  }
};

// Matches base64 tokens of length >= 20 (long enough to encode a phrase)
const BASE64_TOKEN_RE = /[A-Za-z0-9+/]{20,}={0,2}/g;

const INJECTION_RULES: Array<{ label: string; test: (normalised: string, raw: string) => boolean }> = [
  {
    label: "ignore previous instructions",
    test: (n) => n.includes("ignore") && (n.includes("previous") || n.includes("instruction"))
  },
  {
    label: "system prompt / system message",
    test: (n) => n.includes("system prompt") || n.includes("system message")
  },
  {
    label: "you are now / act as",
    test: (n) => n.includes("you are now") || /\bact\s+as\b/.test(n)
  },
  {
    label: "forget everything / disregard",
    test: (n) => n.includes("forget everything") || n.includes("disregard")
  },
  {
    label: "base64 encoded injection",
    test: (_n, raw) => {
      const tokens = raw.match(BASE64_TOKEN_RE) ?? [];
      return tokens.some(containsBase64InjectionPayload);
    }
  },
  {
    label: "markdown/HTML injection",
    test: (n) =>
      // HTML tags that could wrap malicious content
      /<(script|iframe|object|embed|form|input|style|link|meta|svg)[^>]*>/i.test(n) ||
      // Markdown image/link syntax with javascript: protocol
      /\[.*?\]\s*\(\s*javascript:/i.test(n) ||
      // HTML comment tricks
      /<!--.*?-->/s.test(n)
  }
];

export const detectPromptInjection = (input: string): PromptInjectionResult => {
  const normalised = normaliseForInjectionCheck(input);
  const patterns: string[] = [];

  for (const rule of INJECTION_RULES) {
    if (rule.test(normalised, input)) {
      patterns.push(rule.label);
    }
  }

  return { detected: patterns.length > 0, patterns };
};

// ---------------------------------------------------------------------------
// Input Boundary Validation
// ---------------------------------------------------------------------------

interface InputBoundaryResult {
  valid: boolean;
  issues: string[];
}

const DEFAULT_MAX_LENGTH = 10_000;

export const validateInputBoundary = (
  input: string,
  maxLength: number = DEFAULT_MAX_LENGTH
): InputBoundaryResult => {
  const issues: string[] = [];

  if (input.length > maxLength) {
    issues.push(`Input exceeds maximum length of ${maxLength} characters`);
  }

  // Null bytes
  if (input.includes("\0")) {
    issues.push("Input contains null bytes");
  }

  // Control characters — allow HT (0x09) and LF (0x0A) and CR (0x0D) only
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(input)) {
    issues.push("Input contains disallowed control characters");
  }

  // UTF-8 validity: encode to a Buffer and back; if it round-trips cleanly
  // the string is valid UTF-8.  JavaScript strings are UTF-16 internally, so
  // we test for lone surrogates which cannot be encoded to valid UTF-8.
  if (/[\uD800-\uDFFF]/.test(input)) {
    issues.push("Input contains invalid UTF-8 sequences (lone surrogates)");
  }

  return { valid: issues.length === 0, issues };
};

// ---------------------------------------------------------------------------
// Secret Exposure Detection
// ---------------------------------------------------------------------------

interface SecretExposureResult {
  found: boolean;
  types: string[];
}

const SECRET_RULES: Array<{ label: string; pattern: RegExp }> = [
  // OpenAI / generic "sk-" style API keys
  { label: "api_key", pattern: /\bsk-[A-Za-z0-9]{20,}\b/ },
  // Generic key-* or apikey patterns
  { label: "api_key", pattern: /\b(?:key-[A-Za-z0-9]{16,}|apikey\s*[:=]\s*\S{8,})\b/i },
  // AWS access key ID
  { label: "aws_credentials", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  // AWS secret access key
  { label: "aws_credentials", pattern: /aws_secret_access_key\s*[:=]\s*\S{16,}/i },
  // JWT — starts with eyJ (base64 of '{"')
  { label: "jwt_token", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
  // PEM private keys
  { label: "private_key", pattern: /-----BEGIN\s[\w\s]*PRIVATE KEY-----/ },
  // Database connection strings
  { label: "database_connection_string", pattern: /\b(?:postgres|postgresql|mysql|mongodb):\/\/[^\s'"]+/ },
  // Generic password/secret/token assignment with a value
  { label: "generic_secret", pattern: /\b(?:password|secret|token)\s*[:=]\s*['"]?[A-Za-z0-9+/!@#$%^&*_-]{6,}['"]?/i }
];

export const detectSecretExposure = (text: string): SecretExposureResult => {
  const foundTypes = new Set<string>();

  for (const rule of SECRET_RULES) {
    if (rule.pattern.test(text)) {
      foundTypes.add(rule.label);
    }
  }

  const types = Array.from(foundTypes);
  return { found: types.length > 0, types };
};
