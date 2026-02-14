# @terna/support-sdk

Client-side diagnostic capture SDK — screenshots, console logs, network activity, browser info — with privacy-first design.

A standalone, framework-agnostic JavaScript/TypeScript SDK that captures client-side diagnostic data and submits it to a configurable backend, with strong privacy controls and per-report user consent.

## Features

- **Console capture** — intercepts `console.log/warn/error/info/debug`
- **Network capture** — records fetch and XHR requests/responses
- **Screenshot capture** — takes a screenshot of the current page
- **Browser info** — collects viewport, user agent, screen dimensions
- **User breadcrumbs** — tracks clicks, navigation, and custom events
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

const sdk = new SupportSDK({
  endpoint: 'https://your-api.com/reports',
  auth: { type: 'api-key', key: 'your-api-key' },
});

await sdk.init();

// SDK captures diagnostics in the background.
// When the user clicks the trigger button, they review
// captured data and submit a report.
```

### Script Tag

```html
<script src="https://unpkg.com/@terna/support-sdk/dist/index.global.js"></script>
<script>
  const sdk = new SupportSDK.SupportSDK({
    endpoint: 'https://your-api.com/reports',
    auth: { type: 'none' },
  });
  sdk.init();
</script>
```

## Backend Contract

The SDK defines the API contract. Import the types to implement a compatible backend:

```ts
import type { DiagnosticReport, ReportCreateResponse } from '@terna/support-sdk/contract';
```

Any backend (Express, FastAPI, Rails, etc.) can implement the contract to receive reports.

## Privacy

The SDK never captures passwords, localStorage, cookies, clipboard, or file contents.

All data passes through three sanitization layers:

1. **Capture-time** — auth headers stripped, PII patterns redacted as data enters ring buffers
2. **Pre-submission** — full sanitizer pass + user reviews all data in a modal before sending
3. **Server-side** — backend should re-run redaction (documented in the contract)

Auto-redacted patterns: JWTs, email addresses, phone numbers, and sensitive URL parameters (`token`, `key`, `secret`, `password`, `code`, `otp`).

## Configuration

```ts
const sdk = new SupportSDK({
  // Required
  endpoint: 'https://your-api.com/reports',

  // Auth — choose one
  auth:
    | { type: 'api-key'; key: string; headerName?: string }
    | { type: 'bearer'; token: string | (() => string | Promise<string>) }
    | { type: 'custom'; handler: (headers: Headers) => void | Promise<void> }
    | { type: 'none' },

  // Capture settings
  capture: {
    console: { maxItems: 100, levels: ['log', 'warn', 'error'] },
    network: { maxItems: 50, urlFilter: (url) => !url.includes('/health') },
    breadcrumbs: { maxItems: 50 },
    screenshot: true,
  },

  // Privacy overrides
  privacy: {
    redactPatterns: [/SSN-\d{3}-\d{2}-\d{4}/g],
    sensitiveHeaders: ['x-custom-secret'],
    sensitiveParams: ['session_id'],
    maxBodySize: 10_000,
    stripBodies: false,
  },

  // UI customization
  ui: {
    triggerPosition: 'bottom-right',
    triggerLabel: 'Report Issue',
    modalTitle: 'Submit Bug Report',
    showTrigger: true,
  },

  // User context attached to reports
  user: { id: '123', email: 'user@example.com', name: 'Jane' },
});
```

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
