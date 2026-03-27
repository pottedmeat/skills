---
name: pr-description
description: Analyzes version control diffs and generates pull request descriptions optimized for senior engineer audiences. Provides structured descriptions with context, specific changes, testing plans, and breaking change detection.
triggers:
  - "generate a pr description"
  - "write a pull request description"
  - "create a pr description for this diff"
  - "help me write a pr description"
  - "draft a pull request for these changes"
negatives:
  - "review my pull request"
  - "write a commit message"
  - "create a changelog"
---

# PR Description Generator

## Purpose

Generate clear, comprehensive pull request descriptions that communicate intent, scope, and impact to senior engineer reviewers.

## Critical Rules

- **Never be vague** — "Updated files" wastes everyone's time
- **Context first** — Senior engineers need to understand the "why" immediately
- **Specific changes** — List exact modifications, not generalizations
- **Testing steps** — Provide step-by-step verification instructions
- **Flag breaking changes** — Must be explicitly called out upfront

## Workflow

### 1. Gather Context

If working in a git repository:
- Run `git log main..HEAD --oneline` for commit history
- Run `git diff main...HEAD --stat` for file change summary
- Run `git diff main...HEAD` for full diff
- Check for PR template at `.github/PULL_REQUEST_TEMPLATE.md`

If user provides changes directly:
- Analyze the provided diff, commits, or file changes

### 2. Analyze Changes

Categorize by:
- **Type**: feature, fix, refactor, docs, test, chore, perf
- **Scope**: files affected, modules touched, API surface changed
- **Impact**: breaking changes, deprecations, new capabilities
- **Risk**: areas needing careful review, edge cases

### 3. Detect Breaking Changes

Flag patterns from breaking-change-patterns.md:
- Removed/renamed public APIs
- Changed function signatures
- Required new parameters
- Schema/config changes
- Behavior changes

### 4. Generate Description

Use this template:

```markdown
## Description
[Specific one-line summary of what this PR does]

## Context & Motivation
[Why this change is needed. Link to issues if available.]

## Changes Made
- [Specific change 1 with file/module context]
- [Specific change 2 with concrete details]

## Testing Plan
1. [Step 1: Command or action]
2. [Step 2: Verification step]
3. [Step 3: Edge case validation]

## Screenshots / Videos
[For UI changes - describe or note N/A]

## Checklist
- [ ] Self-review completed
- [ ] Tests added/updated and passing
- [ ] Documentation updated where applicable
- [ ] No new warnings or console errors

## Breaking Changes / Migration Notes
[Explicit callouts if applicable, or "None"]
```

## Anti-Patterns

Avoid:
- Vague summaries like "Various improvements"
- Listing files without describing changes
- Hiding breaking changes mid-document
- Future tense ("will add") - use imperative mood
- Assuming invisible context

## Examples

### Feature Addition

Input diff shows new rate limiting middleware.

Output:
```markdown
## Description
Adds configurable rate limiting middleware to the HTTP server stack.

## Context & Motivation
The API has experienced traffic spikes leading to service degradation. This middleware provides a configurable defense mechanism.

## Changes Made
- Add `RateLimiter(requestsPerSecond int) Middleware` in `middleware/rate_limit.go`
- Returns HTTP 429 when limit exceeded

## Testing Plan
1. Run `go test ./middleware/...`
2. Send 20 rapid requests with limit=10 rps
3. Verify HTTP 429 for requests exceeding limit

## Breaking Changes / Migration Notes
None - purely additive change
```

### Breaking Change

Input diff shows signature change: `GetUser(id int)` → `GetUser(ctx context.Context, id string)`

Output:
```markdown
## Description
Updates `GetUser` to accept `context.Context` and string-based IDs for timeout/cancellation support.

## Context & Motivation
Part of API modernization initiative (Issue #342) for context-aware APIs and UUID compatibility.

## Changes Made
- Modified `GetUser(id int)` → `GetUser(ctx context.Context, id string)` in `services/user.go`
- Updated all 12 call sites across `handlers/` and `services/`

## Testing Plan
1. Run `go test ./...` - all tests updated
2. Verify timeout behavior with 1s deadline context
3. Test invalid UUID format error handling

## Breaking Changes / Migration Notes
⚠️ **BREAKING CHANGE**
- All callers must pass `context.Context` as first argument
- ID type changed from `int` to `string` (UUID format)
- Migration: `GetUser(123)` → `GetUser(context.Background(), "uuid-string")`
```
