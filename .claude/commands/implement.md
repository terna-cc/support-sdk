# Feature Implementation Workflow

You are orchestrating a full feature implementation cycle. The feature to implement is:

$ARGUMENTS

## Workflow Steps

Execute these phases in order:

### Phase 1: Planning
Use the `EnterPlanMode` tool to enter plan mode. In plan mode:
- Analyze the requirement thoroughly
- Explore the codebase for relevant patterns and existing conventions
- Use the `planner` agent if the feature is complex
- Create a detailed technical specification
- Identify all files that need changes
- Consider component hierarchy and state management

Write your plan and use `ExitPlanMode` to get user approval before proceeding.

### Phase 2: Implementation
Once the plan is approved, use the `coder` agent to:
- Implement the changes following the approved plan
- Follow React/TypeScript best practices
- Make incremental changes
- Run linting after changes: `npm run lint`
- Run type check: `npx tsc --noEmit`
- Report what was implemented

### Phase 3: Testing
After implementation, use the `tester` agent to:
- Write comprehensive tests using React Testing Library
- Focus on user behavior, not implementation details
- Use proper query hierarchy (getByRole preferred)
- Run tests: `npm test`
- Verify 80%+ coverage
- Report coverage and any gaps

### Phase 4: Review
Finally, use the `reviewer` agent to:
- Review all changes made
- Run automated checks (eslint, tsc)
- Check for accessibility issues
- Verify React best practices
- Provide final assessment

## Coordination Rules

1. Complete each phase before starting the next
2. After each agent completes, summarize the results to the user
3. Ask for user confirmation before major transitions
4. If an agent finds issues, address them before continuing
5. If tests fail, fix before proceeding to review

## Quick Reference

```bash
# Linting
npm run lint

# Type checking
npx tsc --noEmit

# Testing
npm test
npm test -- --coverage

# Build (verify no errors)
npm run build
```

Begin with Phase 1: Enter plan mode now.
