# @terna/support-sdk

Client-side diagnostic capture SDK — screenshots, console logs, network activity, browser info — with privacy-first design.

A standalone, framework-agnostic JavaScript/TypeScript SDK that captures client-side diagnostic data and submits it to a configurable backend, with strong privacy controls and per-report user consent.

## Features

- **Console capture** — intercepts `console.log/warn/error/info/debug`
- **Network capture** — records fetch and XHR requests/responses
- **Screenshot capture** — takes a screenshot of the current page
- **Browser info** — collects viewport, user agent, screen dimensions
- **User breadcrumbs** — tracks clicks, navigation, and custom events
- **Error auto-capture** — detects uncaught errors and unhandled rejections, shows a toast for user consent
- **Privacy-first** — 3-layer sanitization (capture-time, pre-submission review, server-side)
- **Shadow DOM UI** — review modal and trigger button isolated from host styles
- **Framework-agnostic** — vanilla JS core, works with any web app
- **Backend-agnostic** — ships a contract (types + schemas) any backend can implement

## Install

```bash
npm install @terna/support-sdk
```

## Quick Start

```ts
import { SupportSDK } from '@terna/support-sdk';

const sdk = SupportSDK.init({
  endpoint: 'https://your-api.com',
  auth: { type: 'api-key', key: 'your-project-key' },
});
```

That's it. The SDK captures diagnostics in the background. A floating trigger button lets users review captured data and submit a report.

### Script Tag

```html
<script src="https://unpkg.com/@terna/support-sdk/dist/index.global.js"></script>
<script>
  SupportSDK.SupportSDK.init({
    endpoint: 'https://your-api.com',
    auth: { type: 'none' },
  });
</script>
```

## Configuration

```ts
const sdk = SupportSDK.init({
  // Required — base URL of your backend
  endpoint: 'https://your-api.com',

  // Authentication (optional, defaults to { type: 'none' })
  auth: { type: 'api-key', key: 'your-project-key' },

  // Capture modules (optional — all enabled by default)
  capture: {
    console: { maxItems: 100 },   // or false to disable
    network: { maxItems: 50 },    // or false to disable
    breadcrumbs: { maxItems: 50 },// or false to disable
    screenshot: true,             // false to disable
  },

  // Privacy overrides (optional)
  privacy: {
    redactPatterns: [/SSN-\d{3}-\d{2}-\d{4}/g],
    sensitiveHeaders: ['x-custom-secret'],
    sensitiveParams: ['session_id'],
    maxBodySize: 10_000,
    stripBodies: false,
  },

  // UI customization (optional)
  ui: {
    triggerPosition: 'bottom-right', // 'bottom-left' | 'top-right' | 'top-left'
    triggerLabel: 'Report Issue',
    modalTitle: 'Submit Bug Report',
    showTrigger: true,               // false to hide the floating button
  },

  // User context attached to every report (optional)
  user: { id: '123', email: 'user@example.com', name: 'Jane' },
});
```

### Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `endpoint` | `string` | *required* | Base URL of the backend that receives reports |
| `auth` | `AuthConfig` | `{ type: 'none' }` | Authentication strategy |
| `capture.console` | `object \| false` | `{ maxItems: 100 }` | Console log capture settings |
| `capture.network` | `object \| false` | `{ maxItems: 50 }` | Network request capture settings |
| `capture.breadcrumbs` | `object \| false` | `{ maxItems: 50 }` | User action breadcrumb settings |
| `capture.screenshot` | `boolean` | `true` | Enable screenshot capture |
| `privacy.redactPatterns` | `RegExp[]` | `[]` | Additional regex patterns to redact |
| `privacy.sensitiveHeaders` | `string[]` | `[]` | Additional headers to strip |
| `privacy.sensitiveParams` | `string[]` | `[]` | Additional URL params to redact |
| `privacy.maxBodySize` | `number` | `10000` | Max request/response body size in bytes |
| `privacy.stripBodies` | `boolean` | `false` | Strip all request/response bodies |
| `ui.triggerPosition` | `string` | `'bottom-right'` | Position of the floating button |
| `ui.triggerLabel` | `string` | `'Report Issue'` | Label text on the trigger button |
| `ui.modalTitle` | `string` | `'Send Diagnostic Report'` | Title of the review modal |
| `ui.showTrigger` | `boolean` | `true` | Show the floating trigger button |
| `user` | `UserContext` | `undefined` | User context attached to reports |

### Auth Types

```ts
// API key (sent as a custom header)
{ type: 'api-key', key: 'your-key', headerName?: 'X-Project-Key' }

// Bearer token (string or async function)
{ type: 'bearer', token: 'your-token' }
{ type: 'bearer', token: () => getTokenFromAuth() }

// Custom handler
{ type: 'custom', handler: (headers) => headers.set('Authorization', 'Custom xyz') }

// No auth
{ type: 'none' }
```

## Programmatic API

### `SupportSDK.init(config): SupportSDK`

Initialize the SDK. Returns the singleton instance. Calling `init()` again without `destroy()` warns and returns the existing instance.

### `sdk.triggerReport(options?): void`

Manually trigger a report. Freezes all capture buffers, takes a screenshot, and opens the review modal.

```ts
sdk.triggerReport();
```

### `sdk.addBreadcrumb(crumb): void`

Add a custom breadcrumb entry.

```ts
sdk.addBreadcrumb({
  type: 'custom',
  message: 'User completed onboarding',
  data: { step: 3 },
});
```

### `sdk.setUser(user): void`

Update the user context attached to future reports.

```ts
sdk.setUser({ id: '123', email: 'user@example.com', name: 'Jane' });
```

### `sdk.setMetadata(metadata): void`

Set arbitrary metadata attached to future reports.

```ts
sdk.setMetadata({ environment: 'production', appVersion: '2.1.0' });
```

### `sdk.destroy(): void`

Tear down the SDK: stops all capture modules (restoring patched globals), removes all DOM elements, and clears the singleton.

```ts
sdk.destroy();
```

## Privacy

The SDK never captures passwords, localStorage, cookies, clipboard, or file contents.

All data passes through three sanitization layers:

1. **Capture-time** — auth headers stripped, PII patterns redacted as data enters ring buffers
2. **Pre-submission** — full sanitizer pass + user reviews all data in a modal before sending
3. **Server-side** — backend should re-run redaction (documented in the contract)

### What is always redacted

- `Authorization`, `Cookie`, `Set-Cookie` headers — stripped entirely
- JWT tokens → `[REDACTED:jwt]`
- Email addresses → `[REDACTED:email]`
- Phone numbers → `[REDACTED:phone]`
- URL params: `token`, `key`, `secret`, `password`, `code`, `otp` → `[REDACTED]`

### User consent flow

1. Data is captured in the background into ring buffers
2. When a report is triggered (manually or via error detection), the user sees a review modal
3. The modal shows all captured data with checkboxes — the user chooses what to include
4. Only after the user clicks "Send Report" is any data transmitted to the backend

## Backend Contract

The SDK defines the API contract. Import the types to implement a compatible backend:

```ts
import type {
  DiagnosticReport,
  ReportCreateResponse,
} from '@terna/support-sdk/contract';
```

**Expected endpoint:** `POST {endpoint}/reports`

The SDK sends a `multipart/form-data` request with:
- `report` — JSON string of the `DiagnosticReport`
- `screenshot` — JPEG blob (optional)

The backend should return a JSON response matching `ReportCreateResponse`:

```json
{ "id": "report-uuid", "createdAt": "2025-01-01T00:00:00Z" }
```

Any backend (Express, FastAPI, Rails, etc.) can implement the contract to receive reports.

## Development

```bash
npm install        # install dependencies
npm run build      # build ESM + CJS + IIFE + DTS
npm run dev        # build in watch mode
npm test           # run tests
npm run test:watch # run tests in watch mode
npm run typecheck  # type-check without emitting
npm run lint       # lint with ESLint
npm run format     # format with Prettier
```

## Package Outputs

```
dist/
├── index.mjs          # ESM
├── index.cjs          # CJS
├── index.global.js    # IIFE (for <script> tag)
├── index.d.ts         # TypeScript declarations
└── contract/
    ├── index.mjs      # Contract types (ESM)
    ├── index.cjs      # Contract types (CJS)
    └── index.d.ts     # Contract type declarations
```

## Browser Support

Chrome, Firefox, Safari, Edge — last 2 versions.

## License

MIT
