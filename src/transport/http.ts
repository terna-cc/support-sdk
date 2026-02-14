import type { AuthConfig, DiagnosticReport } from '../types';

export interface TransportConfig {
  endpoint: string;
  auth: AuthConfig;
  timeout?: number;
  maxRetries?: number;
}

export interface TransportResult {
  success: boolean;
  reportId?: string;
  error?: {
    status: number;
    message: string;
  };
}

export interface Transport {
  sendReport(
    report: DiagnosticReport,
    screenshot?: Blob,
  ): Promise<TransportResult>;
}

const DEFAULT_TIMEOUT = 10_000;
const DEFAULT_MAX_RETRIES = 1;
const RETRY_DELAY = 1_000;

const ERROR_MESSAGES: Record<number, string> = {
  400: 'Report could not be sent',
  401: 'Authentication error',
  403: 'Authentication error',
  413: 'Report too large',
  429: 'Too many reports, try again later',
};

function getErrorMessage(status: number): string {
  if (ERROR_MESSAGES[status]) {
    return ERROR_MESSAGES[status];
  }
  if (status >= 500) {
    return 'Server error, try again later';
  }
  return `Unexpected error (${status})`;
}

function isServerError(status: number): boolean {
  return status >= 500 && status < 600;
}

async function resolveAuthHeaders(auth: AuthConfig): Promise<Headers> {
  const headers = new Headers();

  switch (auth.type) {
    case 'api-key':
      headers.set(auth.headerName ?? 'X-Project-Key', auth.key);
      break;
    case 'bearer': {
      const token =
        typeof auth.token === 'function' ? await auth.token() : auth.token;
      headers.set('Authorization', `Bearer ${token}`);
      break;
    }
    case 'custom':
      await auth.handler(headers);
      break;
    case 'none':
      break;
  }

  return headers;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createTransport(config: TransportConfig): Transport {
  const timeout = config.timeout ?? DEFAULT_TIMEOUT;
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
  const url = `${config.endpoint.replace(/\/+$/, '')}/reports`;

  return {
    async sendReport(
      report: DiagnosticReport,
      screenshot?: Blob,
    ): Promise<TransportResult> {
      const formData = new FormData();
      formData.append('report', JSON.stringify(report));

      if (screenshot) {
        formData.append('screenshot', screenshot, 'screenshot.jpg');
      }

      let authHeaders: Headers;
      try {
        authHeaders = await resolveAuthHeaders(config.auth);
      } catch {
        return {
          success: false,
          error: { status: 0, message: 'Authentication error' },
        };
      }

      let lastStatus = 0;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        if (attempt > 0) {
          await delay(RETRY_DELAY);
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers: authHeaders,
            body: formData,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            return {
              success: true,
              reportId: data.id,
            };
          }

          lastStatus = response.status;

          if (!isServerError(response.status) || attempt === maxRetries) {
            return {
              success: false,
              error: {
                status: response.status,
                message: getErrorMessage(response.status),
              },
            };
          }
        } catch (err) {
          clearTimeout(timeoutId);

          if (attempt === maxRetries) {
            if (
              err instanceof DOMException &&
              err.name === 'AbortError'
            ) {
              return {
                success: false,
                error: { status: 0, message: 'Could not connect to server' },
              };
            }

            return {
              success: false,
              error: { status: 0, message: 'Could not connect to server' },
            };
          }
        }
      }

      return {
        success: false,
        error: {
          status: lastStatus,
          message: getErrorMessage(lastStatus),
        },
      };
    },
  };
}
