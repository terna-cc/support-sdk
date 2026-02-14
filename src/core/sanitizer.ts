export interface SanitizerConfig {
  redactPatterns?: RegExp[];
  sensitiveHeaders?: string[];
  sensitiveParams?: string[];
  maxBodySize?: number;
  stripBodies?: boolean;
}

const DEFAULT_SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'proxy-authorization',
];

const DEFAULT_SENSITIVE_PARAMS = [
  'token',
  'key',
  'secret',
  'password',
  'passwd',
  'code',
  'otp',
  'access_token',
  'refresh_token',
  'api_key',
];

const BUILTIN_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  {
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    replacement: '[REDACTED:jwt]',
  },
  {
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[REDACTED:email]',
  },
  {
    pattern:
      /(\+?\d{1,4}[\s.-]?)?(\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{4}/g,
    replacement: '[REDACTED:phone]',
  },
];

const DEFAULT_MAX_BODY_SIZE = 10_000;

export class Sanitizer {
  private readonly sensitiveHeaders: Set<string>;
  private readonly sensitiveParams: Set<string>;
  private readonly customPatterns: RegExp[];
  private readonly maxBodySize: number;
  private readonly stripBodies: boolean;

  constructor(config: SanitizerConfig = {}) {
    this.sensitiveHeaders = new Set(
      (config.sensitiveHeaders ?? DEFAULT_SENSITIVE_HEADERS).map((h) =>
        h.toLowerCase(),
      ),
    );
    this.sensitiveParams = new Set(
      config.sensitiveParams ?? DEFAULT_SENSITIVE_PARAMS,
    );
    this.customPatterns = config.redactPatterns ?? [];
    this.maxBodySize = config.maxBodySize ?? DEFAULT_MAX_BODY_SIZE;
    this.stripBodies = config.stripBodies ?? false;
  }

  sanitizeString(value: string): string {
    let result = value;

    for (const { pattern, replacement } of BUILTIN_PATTERNS) {
      // Reset regex lastIndex since they're global
      pattern.lastIndex = 0;
      result = result.replace(pattern, replacement);
    }

    for (const pattern of this.customPatterns) {
      const flags = pattern.flags.includes('g')
        ? pattern.flags
        : pattern.flags + 'g';
      const globalPattern = new RegExp(pattern.source, flags);
      result = result.replace(globalPattern, '[REDACTED]');
    }

    return result;
  }

  sanitizeHeaders(
    headers: Record<string, string>,
  ): Record<string, string> {
    const result: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (this.sensitiveHeaders.has(key.toLowerCase())) {
        continue; // strip entirely
      }
      result[key] = this.sanitizeString(value);
    }

    return result;
  }

  sanitizeUrl(url: string): string {
    try {
      const parsed = new URL(url);

      for (const param of this.sensitiveParams) {
        if (parsed.searchParams.has(param)) {
          parsed.searchParams.set(param, '[REDACTED]');
        }
      }

      return parsed.toString();
    } catch {
      // If URL parsing fails, just sanitize as a string
      return this.sanitizeString(url);
    }
  }

  sanitizeBody(body: string | null, _contentType?: string): string | null {
    if (body === null) return null;
    if (this.stripBodies) return null;

    let result = body;
    if (result.length > this.maxBodySize) {
      result = result.slice(0, this.maxBodySize) + '...[TRUNCATED]';
    }

    return this.sanitizeString(result);
  }

  sanitizeObject<T>(obj: T): T {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === 'string') {
      return this.sanitizeString(obj) as T;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item)) as T;
    }

    if (typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        result[key] = this.sanitizeObject(value);
      }
      return result as T;
    }

    return obj;
  }
}
