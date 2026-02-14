# Testing Rules

## Coverage Requirements

- **Minimum 80% coverage** for all code
- **100% coverage** for:
  - Authentication flows
  - Screening trigger/polling logic
  - Critical user journeys
  - Form validation logic

## Test Types Required

### Unit Tests
- Custom hooks
- Utility functions
- Complex component logic

### Integration Tests
- Component interactions
- Form submissions
- API integrations (via MSW)
- User flows

### E2E Tests (Playwright)
- Critical user journeys
- Authentication flows
- CV upload + screening flow

## React Testing Library Standards (Mandatory)

### Query Priority

Use queries in this order:

1. `getByRole` - Accessible to everyone
2. `getByLabelText` - Form fields
3. `getByPlaceholderText` - When no label
4. `getByText` - Non-interactive content
5. `getByTestId` - Last resort only

```tsx
// GOOD - Tests user experience
screen.getByRole('button', { name: /submit/i });
screen.getByLabelText(/email/i);

// AVOID - Tests implementation
screen.getByTestId('submit-button');
container.querySelector('.btn-submit');
```

### User Event over fireEvent

```tsx
// GOOD - Simulates real user
import userEvent from '@testing-library/user-event';
const user = userEvent.setup();
await user.click(button);
await user.type(input, 'text');

// AVOID - Direct event dispatch
fireEvent.click(button);
fireEvent.change(input, { target: { value: 'text' } });
```

## Test-Driven Development Workflow

When implementing new features:

1. **RED** - Write failing test first
2. **GREEN** - Write minimal code to pass
3. **REFACTOR** - Improve code, keep tests passing
4. **VERIFY** - Check coverage meets threshold

```bash
# Run tests with coverage
npm test -- --coverage
```

## Test Organization

```
src/
├── components/
│   └── Button/
│       ├── Button.tsx
│       └── Button.test.tsx    # Co-located test
├── hooks/
│   └── useAuth/
│       ├── useAuth.ts
│       └── useAuth.test.ts
└── __tests__/                  # Integration tests
    └── screening-flow.test.tsx
```

## What Makes a Good Test

```tsx
describe('LoginForm', () => {
  it('shows validation error for invalid email', async () => {
    // Arrange
    const user = userEvent.setup();
    render(<LoginForm />);

    // Act
    await user.type(screen.getByLabelText(/email/i), 'invalid');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    // Assert
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
  });
});
```

- **Descriptive name** - What behavior is tested
- **Arrange-Act-Assert** - Clear structure
- **User-centric** - Tests what users see/do
- **Independent** - No test depends on another
- **Deterministic** - No random failures

## What NOT to Test

- Implementation details (internal state)
- Third-party libraries
- Static content
- Styling (unless critical)

## Mocking Guidelines

### API Calls (MSW)
```tsx
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('https://api.terna.cc/v1/clients', () => {
    return HttpResponse.json([{ id: '1', name: 'Acme Corp' }]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### When to Mock
- External APIs (use MSW)
- Browser APIs not in jsdom
- Time-dependent code
- Cognito auth (mock the auth context)

### When NOT to Mock
- Internal modules (test integration)
- React components (render real components)
- Simple utilities

## Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific file
npm test -- Button.test.tsx

# Run in watch mode
npm test -- --watch

# Update snapshots (use sparingly)
npm test -- -u
```

## Snapshot Testing

Use sparingly and only for:
- Serializable output (not full components)
- Configuration objects
- Error messages

```tsx
// OK - Small, stable output
expect(formatDate(date)).toMatchInlineSnapshot(`"Jan 1, 2024"`);

// AVOID - Large component snapshots
expect(container).toMatchSnapshot(); // Hard to review
```
