# Code Review

Review the following code changes:

$ARGUMENTS

## Review Scope

If no specific files mentioned, review:
1. All uncommitted changes: `git diff`
2. All staged changes: `git diff --staged`

## Review Process

### Step 1: Identify Changes

```bash
# See what files changed
git status

# See the actual changes
git diff

# Or for staged changes
git diff --staged
```

### Step 2: Run Automated Checks

```bash
# Linting
npm run lint

# Type checking
npx tsc --noEmit

# Tests
npm test -- --run

# Build (catch build errors)
npm run build
```

### Step 3: Manual Review

Use the `reviewer` agent for comprehensive code review covering:
- TypeScript correctness
- React best practices
- Performance concerns
- Accessibility
- Test coverage
- Code quality

### Step 4: Security Review (if needed)

For changes involving:
- Authentication/authorization
- User input handling
- API integrations
- localStorage/cookies
- Form submissions

Use the `security-reviewer` agent for in-depth security analysis.

## Review Checklist

### TypeScript
- [ ] No `any` types
- [ ] Proper interface/type definitions
- [ ] Explicit return types on exports

### React
- [ ] Functional components
- [ ] Hooks follow rules
- [ ] Proper useEffect dependencies
- [ ] No derived state in useState
- [ ] Stable keys for lists

### Performance
- [ ] No unnecessary re-renders
- [ ] Memoization only where needed
- [ ] Code splitting for heavy components

### Accessibility
- [ ] Semantic HTML
- [ ] Proper ARIA attributes
- [ ] Keyboard navigation
- [ ] Focus management

### Security
- [ ] No secrets in client code
- [ ] No dangerouslySetInnerHTML with user input
- [ ] Input validation

### Tests
- [ ] Tests exist for new code
- [ ] User-centric queries (getByRole)
- [ ] Good coverage

## Output

Provide a summary with:
1. **Automated tool results**
2. **Critical issues** (must fix)
3. **Suggestions** (should fix)
4. **Positive notes** (what's good)

## Quick Commands

```bash
# Full check
npm run lint && npx tsc --noEmit && npm test -- --run && npm run build

# Just linting
npm run lint -- --fix

# Just tests
npm test -- --run

# Coverage report
npm test -- --coverage
```

Begin by identifying the changes to review.
