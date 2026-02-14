# Backend API Contract

This document defines the HTTP API that any backend must implement to work with `@terna/support-sdk`. The SDK sends diagnostic reports to these endpoints. Your backend receives, stores, and serves them.

All endpoints are relative to a configurable **base endpoint** (e.g., `https://api.example.com/support`).

TypeScript types referenced below are exported from `@terna/support-sdk/contract`.

---

## Endpoints

### `POST {endpoint}/reports`

Submit a diagnostic report.

**Content-Type:** `multipart/form-data`

**Request fields:**

| Field        | Type         | Required | Description                                  |
| ------------ | ------------ | -------- | -------------------------------------------- |
| `report`     | JSON string  | Yes      | Serialized `DiagnosticReport` object         |
| `screenshot` | File (JPEG)  | No       | Screenshot image, max 2 MB                   |

**Authentication:** Configurable per integrator. The SDK sends auth headers based on the `AuthConfig` provided at initialization. See [Authentication](#authentication) below.

**Success response:**

```
HTTP/1.1 201 Created
Content-Type: application/json
```

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-01-15T09:30:00.000Z"
}
```

**Error responses:**

| Status | Meaning               | Body                                                        |
| ------ | --------------------- | ----------------------------------------------------------- |
| `400`  | Invalid payload       | `{ "error": "validation_error", "message": "..." }`        |
| `401`  | Not authenticated     | `{ "error": "unauthorized", "message": "..." }`            |
| `403`  | Not authorized        | `{ "error": "forbidden", "message": "..." }`               |
| `413`  | Payload too large     | `{ "error": "payload_too_large", "message": "..." }`       |
| `429`  | Rate limited          | `{ "error": "rate_limited", "message": "..." }`            |
| `5xx`  | Server error          | `{ "error": "server_error", "message": "..." }`            |

---

### `GET {endpoint}/reports`

List reports with pagination.

**Query parameters:**

| Param      | Type    | Default | Description                          |
| ---------- | ------- | ------- | ------------------------------------ |
| `page`     | integer | `1`     | Page number (1-indexed)              |
| `per_page` | integer | `20`    | Items per page (max 100)             |
| `status`   | string  | —       | Filter by status (e.g., `new`, `reviewed`, `archived`) |

**Success response:**

```
HTTP/1.1 200 OK
Content-Type: application/json
```

```json
{
  "reports": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "description": "Button doesn't respond after login",
      "created_at": "2026-01-15T09:30:00.000Z"
    }
  ],
  "total": 42,
  "page": 1,
  "per_page": 20
}
```

---

### `GET {endpoint}/reports/{report_id}`

Get a single report with full data.

**Success response:**

```
HTTP/1.1 200 OK
Content-Type: application/json
```

The response body is the full `DiagnosticReport` object (see [schema](#diagnosticreport-schema) below) with these additional server-side fields:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-01-15T09:30:00.000Z",
  "screenshot_url": "https://storage.example.com/screenshots/550e8400.jpg",
  "...rest of DiagnosticReport fields"
}
```

`screenshot_url` is present only if a screenshot was submitted with the report.

**Error responses:**

| Status | Meaning        |
| ------ | -------------- |
| `404`  | Report not found |

---

### `DELETE {endpoint}/reports/{report_id}`

Delete a report.

**Success response:**

```
HTTP/1.1 204 No Content
```

**Error responses:**

| Status | Meaning        |
| ------ | -------------- |
| `404`  | Report not found |

---

## Authentication

The SDK supports four authentication modes. The backend must accept whichever mode the integrator configures.

### API Key

The SDK sends a static key in a configurable header.

```
X-Project-Key: sk_live_abc123
```

Header name defaults to `X-Project-Key` but is configurable via `headerName`.

### Bearer Token

Standard `Authorization` header with a bearer token.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
```

The token can be a static string or resolved dynamically (e.g., from an auth provider).

### Custom

The integrator provides a function that sets arbitrary headers. This supports any auth scheme.

### None

No authentication headers are sent. Useful for development or internal tools.

---

## DiagnosticReport Schema

The `report` field in the `POST` request is a JSON-serialized `DiagnosticReport`. Below is the full JSON Schema.

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DiagnosticReport",
  "description": "A client-side diagnostic report captured by @terna/support-sdk",
  "type": "object",
  "required": [
    "description",
    "console",
    "network",
    "breadcrumbs",
    "browser",
    "screenshot",
    "errors",
    "user",
    "metadata",
    "timestamp"
  ],
  "properties": {
    "id": {
      "type": "string",
      "description": "Client-generated ID. The backend may ignore this and assign its own."
    },
    "description": {
      "type": "string",
      "description": "User-provided description of the issue."
    },
    "console": {
      "type": "array",
      "description": "Captured console log entries.",
      "items": { "$ref": "#/$defs/ConsoleEntry" }
    },
    "network": {
      "type": "array",
      "description": "Captured network requests.",
      "items": { "$ref": "#/$defs/NetworkEntry" }
    },
    "breadcrumbs": {
      "type": "array",
      "description": "User interaction breadcrumbs (clicks, inputs, navigations).",
      "items": { "$ref": "#/$defs/Breadcrumb" }
    },
    "browser": {
      "$ref": "#/$defs/BrowserInfo",
      "description": "Browser and device information."
    },
    "screenshot": {
      "type": ["string", "null"],
      "description": "Base64-encoded screenshot data URI, or null if not captured. When submitted via multipart, the screenshot file takes precedence."
    },
    "errors": {
      "type": "array",
      "description": "Captured JavaScript errors.",
      "items": { "$ref": "#/$defs/ErrorInfo" }
    },
    "user": {
      "oneOf": [
        { "$ref": "#/$defs/UserContext" },
        { "type": "null" }
      ],
      "description": "User context provided by the integrator, or null."
    },
    "metadata": {
      "type": "object",
      "additionalProperties": true,
      "description": "Arbitrary key-value metadata from the integrator."
    },
    "timestamp": {
      "type": "number",
      "description": "Unix timestamp (milliseconds) when the report was created."
    }
  },
  "$defs": {
    "ConsoleEntry": {
      "type": "object",
      "required": ["level", "message", "args", "timestamp"],
      "properties": {
        "level": {
          "type": "string",
          "enum": ["log", "info", "warn", "error", "debug"],
          "description": "Console method that was called."
        },
        "message": {
          "type": "string",
          "description": "First argument to the console call, stringified."
        },
        "args": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Remaining arguments, each stringified."
        },
        "timestamp": {
          "type": "number",
          "description": "Unix timestamp (milliseconds)."
        }
      }
    },
    "NetworkEntry": {
      "type": "object",
      "required": [
        "method", "url", "status", "requestHeaders", "responseHeaders",
        "requestBody", "responseBody", "duration", "timestamp"
      ],
      "properties": {
        "method": {
          "type": "string",
          "description": "HTTP method (GET, POST, etc.)."
        },
        "url": {
          "type": "string",
          "description": "Request URL (sensitive params redacted)."
        },
        "status": {
          "type": ["integer", "null"],
          "description": "HTTP status code, or null if the request did not complete."
        },
        "requestHeaders": {
          "type": "object",
          "additionalProperties": { "type": "string" },
          "description": "Request headers (sensitive headers stripped)."
        },
        "responseHeaders": {
          "type": "object",
          "additionalProperties": { "type": "string" },
          "description": "Response headers (sensitive headers stripped)."
        },
        "requestBody": {
          "type": ["string", "null"],
          "description": "Request body (sanitized, truncated)."
        },
        "responseBody": {
          "type": ["string", "null"],
          "description": "Response body (sanitized, truncated)."
        },
        "duration": {
          "type": ["number", "null"],
          "description": "Request duration in milliseconds, or null if not completed."
        },
        "timestamp": {
          "type": "number",
          "description": "Unix timestamp (milliseconds) when the request started."
        }
      }
    },
    "BrowserInfo": {
      "type": "object",
      "required": [
        "userAgent", "browser", "os", "language", "platform", "timezone",
        "online", "screenWidth", "screenHeight", "viewportWidth",
        "viewportHeight", "devicePixelRatio", "url", "referrer"
      ],
      "properties": {
        "userAgent": { "type": "string" },
        "browser": { "type": "string", "description": "Parsed browser name and version." },
        "os": { "type": "string", "description": "Parsed OS name and version." },
        "language": { "type": "string" },
        "platform": { "type": "string" },
        "timezone": { "type": "string" },
        "online": { "type": "boolean" },
        "screenWidth": { "type": "integer" },
        "screenHeight": { "type": "integer" },
        "viewportWidth": { "type": "integer" },
        "viewportHeight": { "type": "integer" },
        "devicePixelRatio": { "type": "number" },
        "url": { "type": "string", "description": "Current page URL when the report was created." },
        "referrer": { "type": "string" },
        "memory": {
          "type": "object",
          "properties": {
            "jsHeapSizeLimit": { "type": "integer" },
            "totalJSHeapSize": { "type": "integer" },
            "usedJSHeapSize": { "type": "integer" }
          },
          "required": ["jsHeapSizeLimit", "totalJSHeapSize", "usedJSHeapSize"]
        },
        "connection": {
          "type": "object",
          "properties": {
            "effectiveType": { "type": "string" },
            "downlink": { "type": "number" },
            "rtt": { "type": "number" }
          },
          "required": ["effectiveType", "downlink", "rtt"]
        }
      }
    },
    "Breadcrumb": {
      "type": "object",
      "required": ["type", "message", "timestamp"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["click", "input", "navigation", "custom"],
          "description": "Category of user action."
        },
        "message": {
          "type": "string",
          "description": "Human-readable description of the action."
        },
        "data": {
          "type": "object",
          "additionalProperties": true,
          "description": "Optional structured data for the breadcrumb."
        },
        "timestamp": {
          "type": "number",
          "description": "Unix timestamp (milliseconds)."
        }
      }
    },
    "ErrorInfo": {
      "type": "object",
      "required": ["message", "timestamp"],
      "properties": {
        "message": {
          "type": "string",
          "description": "Error message."
        },
        "stack": {
          "type": "string",
          "description": "Stack trace, if available."
        },
        "source": {
          "type": "string",
          "description": "Source file where the error occurred."
        },
        "line": {
          "type": "integer",
          "description": "Line number."
        },
        "column": {
          "type": "integer",
          "description": "Column number."
        },
        "timestamp": {
          "type": "number",
          "description": "Unix timestamp (milliseconds)."
        }
      }
    },
    "UserContext": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "email": { "type": "string" },
        "name": { "type": "string" }
      },
      "additionalProperties": true,
      "description": "User information provided by the integrator. All fields are optional."
    }
  }
}
```

---

## Implementation Notes

### Privacy

All data in the report has already been sanitized by the SDK before submission:

- `Authorization`, `Cookie`, `Set-Cookie` headers are stripped from network entries
- JWT tokens are replaced with `[REDACTED:jwt]`
- Email addresses are replaced with `[REDACTED:email]`
- Phone numbers are replaced with `[REDACTED:phone]`
- Sensitive URL parameters (`token`, `key`, `secret`, `password`, `code`, `otp`) are replaced with `[REDACTED]`

**Backends should re-run server-side redaction** as an additional safety layer. The SDK sanitizes at capture time and before submission, but defense in depth is recommended.

### Screenshot Handling

When a screenshot is included, it is sent as a separate `screenshot` field in the multipart form (JPEG, max 2 MB). The backend should:

1. Store the image in object storage (S3, GCS, etc.)
2. Return a `screenshot_url` when serving the report via `GET /reports/{id}`
3. The `screenshot` field in the JSON report body may contain a base64 data URI — the backend can ignore this if the file upload is present

### Rate Limiting

Backends should implement rate limiting. Recommended: 10 reports per minute per API key / bearer token. Return `429 Too Many Requests` with a `Retry-After` header when the limit is exceeded.

### Payload Size

The `report` JSON field is typically 10-100 KB. With a 2 MB screenshot, the total multipart payload can reach ~2.1 MB. Backends should accept payloads up to at least 5 MB to allow headroom.

---

## TypeScript Types

All types referenced above are exported from `@terna/support-sdk/contract`:

```typescript
import type {
  DiagnosticReport,
  ConsoleEntry,
  NetworkEntry,
  BrowserInfo,
  Breadcrumb,
  ErrorInfo,
  UserContext,
} from '@terna/support-sdk/contract';
```

Response types for the `POST` and `GET /reports` endpoints:

```typescript
import type {
  ReportCreateResponse,
  ReportListResponse,
} from '@terna/support-sdk/contract';
```
