# Agents Configuration

## Review guidelines

This is `@terna/support-sdk` — a standalone TypeScript npm package that captures client-side diagnostic data (console logs, network requests, screenshots, browser info) and submits it to a configurable backend with privacy-first design.

### P0 — Critical (must fix before merge)

- PII leaks: all data must flow through the Sanitizer before storage or transmission
- No raw auth tokens, emails, phone numbers, or passwords in captured data
- No `innerHTML` usage — only `createElement`/`textContent` (XSS prevention)
- Shadow DOM isolation for all UI components
- `destroy()` methods must fully clean up (no leaked event listeners or patched globals)
- Network capture must exclude the SDK's own report submission requests

### P1 — Important (should fix)

- Bundle size: flag any dependency that could push us over 40KB gzipped
- Ring buffers must evict correctly and respect capacity limits
- Monkey-patched globals (console, fetch, XHR, history) must be fully restored on destroy
- All public APIs must be fully typed — no untyped `any` without justification
- Contract types must match BACKEND_CONTRACT.md exactly
- Error handling: capture modules should never throw — fail silently

### P2 — Suggestions

- Prefer native browser APIs over external libraries
- Test coverage for start/stop lifecycle of capture modules
- Sanitizer tests for each redaction pattern
