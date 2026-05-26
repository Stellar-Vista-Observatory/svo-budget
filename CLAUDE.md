@AGENTS.md

# Development Workflow

## Test-Driven Development

All bug fixes and new features must follow TDD strictly:

1. Write a failing test first — no production code before a test exists
2. Verify the test fails for the right reason
3. Write minimal code to make it pass
4. Verify all tests pass
5. Refactor if needed, keeping tests green

Run `npx jest` to execute the test suite. Run `npx eslint <file>` on every modified file before marking work complete.

No exceptions without explicit user permission.
