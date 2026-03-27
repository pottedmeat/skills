# PR Description Skill - Learnings

## Observations

*Document insights and improvement opportunities as the skill is used.*

---

## Effective Patterns

### Summary Writing

**Good**: "Add retry logic to the HTTP client to handle transient failures."
- Captures action + motivation in one line

**Bad**: "Improve error handling."
- Too vague, doesn't say what changed

### Changes Section

**Good**: "Add `RetryPolicy` interface for pluggable retry strategies"
- Action + target + context

**Bad**: "src/client/HttpClient.java"
- Just a file name, no description

### Breaking Changes

**Good**: Show before/after code examples immediately
**Bad**: Bury at end or in separate document

### Review Guidance

**Good**: "Focus on `ExponentialBackoff.calculateDelay()` - verify jitter calculation"
**Bad**: "Please review carefully"

## Common Mistakes

1. Missing the "why" - always link to issues or explain motivation
2. Assuming context - never reference "the discussion" without linking
3. Hiding breaking changes - they get their own section near the top
4. No review guidance - reviewers need to know what to focus on
