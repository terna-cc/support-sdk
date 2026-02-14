# Test-Driven Development Workflow

Implement the following using TDD methodology:

$ARGUMENTS

## TDD Cycle

Follow RED → GREEN → REFACTOR strictly:

### 1. RED: Write Failing Test

First, write a test that describes the expected behavior:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { FeatureComponent } from './FeatureComponent';

describe('FeatureComponent', () => {
  it('shows success message after form submission', async () => {
    const user = userEvent.setup();
    render(<FeatureComponent />);

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByText(/success/i)).toBeInTheDocument();
  });
});
```

Run the test - it MUST fail:
```bash
npm test -- FeatureComponent.test.tsx
```

### 2. GREEN: Minimal Implementation

Write the minimum code to make the test pass:
- Don't over-engineer
- Don't add extra features
- Just make the test green

Run the test - it MUST pass:
```bash
npm test -- FeatureComponent.test.tsx
```

### 3. REFACTOR: Improve Code

With tests passing, improve the code:
- Extract reusable hooks
- Improve component structure
- Better naming
- Keep tests green

Run all related tests:
```bash
npm test -- FeatureComponent
```

### 4. REPEAT

Continue with the next test case:
- Edge cases
- Error states
- Loading states
- Accessibility

## Test Categories

### Component Rendering
```tsx
it('renders with default props', () => {
  render(<Button>Click me</Button>);
  expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
});
```

### User Interactions
```tsx
it('calls onClick when clicked', async () => {
  const user = userEvent.setup();
  const handleClick = vi.fn();
  render(<Button onClick={handleClick}>Click</Button>);

  await user.click(screen.getByRole('button'));

  expect(handleClick).toHaveBeenCalledOnce();
});
```

### Async Operations
```tsx
it('shows data after loading', async () => {
  render(<CandidateList />);

  expect(screen.getByText(/loading/i)).toBeInTheDocument();
  expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
  expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
});
```

### Form Validation
```tsx
it('shows error for invalid input', async () => {
  const user = userEvent.setup();
  render(<ClientForm />);

  await user.type(screen.getByLabelText(/name/i), '');
  await user.click(screen.getByRole('button', { name: /create/i }));

  expect(await screen.findByText(/required/i)).toBeInTheDocument();
});
```

### Error States
```tsx
it('shows error message on API failure', async () => {
  server.use(
    http.get('*/v1/clients', () => {
      return HttpResponse.json({ error: 'Server Error' }, { status: 500 });
    })
  );

  render(<ClientList />);
  expect(await screen.findByRole('alert')).toHaveTextContent(/error/i);
});
```

### Accessibility
```tsx
it('is keyboard navigable', async () => {
  const user = userEvent.setup();
  render(<Dropdown options={['Active', 'Paused', 'Closed']} />);

  await user.tab();
  await user.keyboard('{Enter}');
  await user.keyboard('{ArrowDown}');
  await user.keyboard('{Enter}');

  expect(screen.getByRole('combobox')).toHaveTextContent('Paused');
});
```

## Query Priority

Always use queries in this order:

1. `getByRole` - Best for accessibility
2. `getByLabelText` - Form fields
3. `getByPlaceholderText` - When no label
4. `getByText` - Static content
5. `getByTestId` - Last resort

## Coverage Requirements

After completing all tests:

```bash
npm test -- --coverage
```

- **80% minimum** for general code
- **100%** for auth flows, screening logic, critical paths

## Process

1. Understand the feature requirements
2. Identify test scenarios
3. Write first failing test (user-centric)
4. Implement minimal code to pass
5. Refactor if needed
6. Write next test
7. Repeat until feature complete
8. Verify coverage meets threshold

Use the `tester` agent for writing tests if needed.

## Commands Reference

```bash
# Run specific test
npm test -- Button.test.tsx

# Run with watch
npm test -- --watch

# Run with coverage
npm test -- --coverage

# Run matching pattern
npm test -- -t "shows error"

# Update snapshots (use sparingly)
npm test -- -u
```

Begin by identifying the first test to write.
