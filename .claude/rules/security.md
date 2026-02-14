# Security Rules

These rules are ALWAYS enforced. Violations block merges.

## Pre-Commit Security Checks

Before any commit, verify:

1. **No Hardcoded Secrets**
   - No API keys, tokens, passwords in code
   - Use environment variables
   - Check: `grep -r "api_key\s*=" --include="*.ts" --include="*.tsx" . | grep -v node_modules`

2. **XSS Prevention**
   - No `dangerouslySetInnerHTML` with unsanitized user input
   - If needed, use DOMPurify: `DOMPurify.sanitize(html)`
   - Never use `eval()` or `new Function()` with user input

3. **No Sensitive Data in Client**
   - Server secrets stay on server
   - Only `VITE_*` env vars are exposed to client code
   - Cognito tokens are managed by the auth library — don't store raw tokens manually

4. **Input Validation**
   - Validate all user input
   - Sanitize before display
   - Validate file uploads (type, size) — especially CV uploads

5. **Secure Communication**
   - HTTPS only
   - Proper CORS configuration
   - Validate API responses

## Environment Variables

```bash
# .env.local (NEVER commit)

# Client-accessible (VITE_ prefix required for Vite)
VITE_API_BASE_URL=https://api.terna.cc
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxx
VITE_COGNITO_CLIENT_ID=xxxxx
VITE_COGNITO_REGION=us-east-1
VITE_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

```tsx
// RIGHT - Vite exposes only VITE_ prefixed vars
const apiUrl = import.meta.env.VITE_API_BASE_URL;

// WRONG - This would be undefined in the browser
const secret = import.meta.env.SECRET_KEY;
```

## Dangerous Patterns

### XSS Vulnerabilities

```tsx
// DANGEROUS
<div dangerouslySetInnerHTML={{ __html: userInput }} />

// SAFE - React auto-escapes
<div>{userInput}</div>

// SAFE - If HTML needed, sanitize
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

### URL Manipulation

```tsx
// DANGEROUS - Open redirect
window.location.href = params.get('redirect');

// SAFE - Validate redirect
const allowedHosts = ['app.terna.cc', 'terna.cc'];
const redirect = new URL(params.get('redirect'), window.location.origin);
if (allowedHosts.includes(redirect.hostname)) {
  navigate(redirect.pathname);
}
```

### Token Storage

```tsx
// Cognito SDK handles token storage — don't manage tokens manually.
// If you must access the token (e.g. for the API client), get it
// from the Cognito session, never store it separately.
```

## Incident Response

If you discover a vulnerability:

1. **STOP** - Don't commit or push
2. **Document** - Note the issue and location
3. **Assess** - Determine if secrets were exposed
4. **Remediate** - Fix the issue
5. **Rotate** - If secrets exposed, rotate them immediately
6. **Verify** - Confirm the fix works
7. **Scan** - Check for similar issues elsewhere

## Severity Levels

**CRITICAL (Block immediately)**
- Hardcoded production secrets
- XSS vulnerability with user input
- Exposed API keys in client bundle
- Authentication bypass

**HIGH (Must fix before merge)**
- Missing input validation
- Insecure token storage
- Open redirects

**MEDIUM (Should fix)**
- Missing security headers
- Verbose error messages
- Console.log with sensitive data
