# Git Workflow Rules

## Commit Message Format

Use conventional commits:

```
<type>: <description>

[optional body]

[optional footer]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code change that neither fixes a bug nor adds a feature
- `docs`: Documentation only
- `test`: Adding or fixing tests
- `chore`: Maintenance tasks
- `perf`: Performance improvement
- `ci`: CI/CD changes

### Examples

```bash
# Feature
feat: add client list page

# Bug fix
fix: resolve infinite loop in useEffect

# With body for context
fix: prevent form double submission

Added loading state to submit button and disabled
form during API call to prevent duplicate requests.

# Breaking change
feat!: switch from REST polling to WebSocket for screening
```

## Pull Request Workflow

### PR Requirements

- Clear title following commit convention
- Description of what and why
- Do not mention claude in the description

### PR Template

```markdown
## Summary
[1-2 sentences describing the change]

## Changes
- Change 1
- Change 2

## Test Plan
- [ ] Unit tests added/updated
- [ ] Integration tests pass
- [ ] Manual testing done
- [ ] Tested on mobile viewport

## Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader tested (if applicable)
```

## Protected Actions

**NEVER without explicit approval:**
- Force push to main/production
- Delete branches others are using
- Rewrite published history
- Skip CI checks

**ALWAYS before merge:**
- All tests passing
- No TypeScript errors
- Code review approved
- No merge conflicts
- Branch up to date with target

## Commit Hygiene

- **Atomic commits** - One logical change per commit
- **No WIP commits** - Squash before PR
- **No merge commits in feature branches** - Rebase instead
- **No console.log** - Remove before commit
- Do not add co-authored-by
