# React Best Practices

## Component Guidelines

### File Structure
```
Button/
├── Button.tsx          # Component
├── Button.test.tsx     # Tests
├── Button.module.css   # Styles (optional)
└── index.ts            # Re-export
```

### Component Pattern
```tsx
interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  children,
}: ButtonProps) {
  return (
    <button
      className={cn(styles.button, styles[variant], styles[size])}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}
```

## Hooks

### Rules of Hooks
- Only call at top level (not in loops, conditions)
- Only call from React functions
- Custom hooks start with `use`

### Common Patterns

```tsx
// Data fetching with TanStack Query
function useClients() {
  return useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get('/v1/clients'),
  });
}

// Mutations with cache invalidation
function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClientInput) => api.post('/v1/clients', data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['clients'] }),
  });
}

// Debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
```

## State Management

### Local State
```tsx
// Component-specific, ephemeral
const [isOpen, setIsOpen] = useState(false);
```

### Derived State (Don't Store)
```tsx
// BAD - Redundant state
const [items, setItems] = useState([]);
const [count, setCount] = useState(0);
useEffect(() => setCount(items.length), [items]);

// GOOD - Compute during render
const [items, setItems] = useState([]);
const count = items.length;
```

### Shared State (Context)
```tsx
const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

### Server State (TanStack Query)
```tsx
// All remote data goes through TanStack Query — never manual useEffect + useState
const { data, isLoading, error } = useQuery({
  queryKey: ['projects', clientId],
  queryFn: () => api.get(`/v1/clients/${clientId}/projects`),
});

// Polling for async screening results
const { data: screening } = useQuery({
  queryKey: ['screenings', screeningId],
  queryFn: () => api.get(`/v1/screenings/${screeningId}`),
  refetchInterval: (query) =>
    query.state.data?.status === 'completed' ? false : 2000,
});
```

### URL State
```tsx
// For shareable, bookmarkable views (filters, pagination)
const [searchParams, setSearchParams] = useSearchParams();
```

## Performance

### When to Memoize

```tsx
// useMemo - Expensive computations
const sorted = useMemo(
  () => items.sort((a, b) => expensiveCompare(a, b)),
  [items]
);

// useCallback - Stable references for memoized children
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// memo - Prevent re-renders
const ExpensiveList = memo(function ExpensiveList({ items }) {
  return items.map(item => <ExpensiveItem key={item.id} item={item} />);
});
```

### When NOT to Memoize

```tsx
// DON'T - Simple computation
const doubled = useMemo(() => count * 2, [count]); // Just use: count * 2

// DON'T - Callback not passed to memoized child
const handleClick = useCallback(() => {}, []); // Not needed

// DON'T - Component rarely re-renders
const SimpleComponent = memo(({ title }) => <h1>{title}</h1>); // Overkill
```

### Code Splitting

```tsx
// Lazy load heavy components
const HeavyEditor = lazy(() => import('./HeavyEditor'));

function App() {
  return (
    <Suspense fallback={<Loading />}>
      <HeavyEditor />
    </Suspense>
  );
}
```

### Virtualization

```tsx
// For long lists (candidate lists, activity logs)
import { useVirtualizer } from '@tanstack/react-virtual';
```

## Accessibility

### Semantic HTML
```tsx
// GOOD
<button onClick={handleClick}>Submit</button>
<nav><ul><li><a href="/">Home</a></li></ul></nav>

// BAD
<div onClick={handleClick}>Submit</div>
```

### ARIA When Needed
```tsx
<button aria-expanded={isOpen} aria-controls="menu">
  Toggle Menu
</button>
<div id="menu" role="menu" hidden={!isOpen}>
  {/* menu items */}
</div>
```

### Focus Management
```tsx
function Modal({ isOpen, onClose, children }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  return isOpen ? (
    <div role="dialog" aria-modal="true">
      <button ref={closeRef} onClick={onClose}>Close</button>
      {children}
    </div>
  ) : null;
}
```

## Error Handling

### Error Boundaries
```tsx
class ErrorBoundary extends Component<Props, State> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    Sentry.captureException(error, { extra: info });
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

### API Errors
```tsx
function UserProfile({ userId }) {
  const { data, isLoading, error } = useUser(userId);

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  return <Profile user={data} />;
}
```
