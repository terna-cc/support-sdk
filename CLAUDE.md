# Support SDK — Project Context

## What is this?

A standalone, framework-agnostic JavaScript/TypeScript SDK that captures client-side diagnostic data (console logs, network requests, screenshots, browser info, user breadcrumbs) and submits it to a configurable backend — with strong privacy controls and per-report user consent.

This is a **sellable product**. Terna (a B2B recruitment CRM) is the first customer, but the SDK must work with any web app and any backend.

## Architecture

- **SDK-first contract**: The SDK defines the backend API contract (endpoints + schemas). Any backend (FastAPI, Express, Rails) can implement the contract to receive reports.
- **Framework-agnostic**: Vanilla JS core, optional React wrapper.
- **Shadow DOM UI**: Review modal and trigger button are rendered in Shadow DOM to avoid style conflicts with host apps.
- **Backend-agnostic**: The SDK doesn't care what stack the backend uses. It sends HTTP requests to a configurable endpoint.

## Tech Stack

- **Language**: TypeScript (strict mode)
- **Build**: tsup (ESM + CJS + UMD outputs)
- **Tests**: Vitest + jsdom
- **Package manager**: npm
- **Linting**: ESLint + Prettier
- **CI**: GitHub Actions

## Package Outputs

```
dist/
├── index.mjs          # ESM
├── index.cjs          # CJS
├── index.global.js    # UMD (for <script> tag)
├── index.d.ts         # TypeScript declarations
└── contract/
    ├── index.mjs      # Contract types (ESM)
    ├── index.cjs      # Contract types (CJS)
    └── index.d.ts     # Contract type declarations
```

## Project Structure

```
src/
├── index.ts                 # Main entry — SupportSDK class
├── types.ts                 # All TypeScript interfaces/types
├── core/
│   ├── ring-buffer.ts       # Generic RingBuffer<T> class
│   └── sanitizer.ts         # PII redaction engine
├── capture/
│   ├── console.ts           # Console log interceptor
│   ├── network.ts           # Fetch + XHR interceptor
│   ├── browser.ts           # Browser/device info collector
│   ├── screenshot.ts        # html2canvas-based screenshot
│   └── breadcrumbs.ts       # User action tracker
├── transport/
│   └── http.ts              # HTTP transport with auth + retries
├── ui/
│   ├── modal.ts             # Shadow DOM review modal
│   ├── trigger.ts           # Floating report button
│   ├── toast.ts             # Error auto-capture toast
│   └── styles.ts            # Embedded CSS (no external stylesheets)
└── contract/
    ├── index.ts             # Exported contract types
    └── schema.ts            # JSON Schema for validation
```

## Key Design Decisions

### Privacy — 3-Layer Defense
1. **Capture-time**: Data sanitized as it enters ring buffers (auth headers stripped, PII patterns redacted)
2. **Pre-submission**: Full sanitizer pass + user reviews all data in modal before anything is sent
3. **Server-side**: Backend should re-run redaction (documented in contract)

### What is NEVER captured
- Passwords (`<input type="password">`)
- localStorage / sessionStorage / IndexedDB
- Cookies (headers stripped)
- Clipboard, audio/video, file contents

### What is ALWAYS redacted
- `Authorization`, `Cookie`, `Set-Cookie` headers → stripped entirely
- JWT tokens → `[REDACTED:jwt]`
- Email addresses → `[REDACTED:email]`
- Phone numbers → `[REDACTED:phone]`
- URL params: token, key, secret, password, code, otp → `[REDACTED]`

### Ring Buffers
All capture modules use a generic `RingBuffer<T>` with configurable capacity. Oldest entries are evicted when the buffer is full. Hard caps prevent memory bloat.

### UI Isolation
All UI (trigger button, review modal, toast) is rendered inside Shadow DOM. No styles leak in or out. CSS is embedded as template literals — no external stylesheets.

## Non-Functional Requirements

- Bundle size: < 40KB gzipped
- Zero performance impact when idle (no polling, no continuous capture)
- Works in: Chrome, Firefox, Safari, Edge (last 2 versions)
- TypeScript-first with full type exports
- `sdk.destroy()` must cleanly restore all patched globals and remove all DOM

## Conventions

- All source code in `src/`
- Tests co-located: `src/**/*.test.ts`
- Use `vitest` for all tests
- Prefer functional patterns over classes where it makes sense (classes OK for stateful modules like RingBuffer, SDK)
- No external runtime dependencies except `modern-screenshot` (for screenshot capture)
- All CSS embedded as strings (no CSS files, no CSS-in-JS libraries)
