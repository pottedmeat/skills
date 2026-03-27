# PR Description Skill - Design Contract

## Intent

Generate senior-engineer-friendly PR descriptions from version control diffs.

## Goals

1. Reduce review friction with context-first descriptions
2. Standardize PR format for consistency
3. Surface breaking changes proactively
4. Save reviewer time with specific, actionable content

## Success Criteria

- Generated descriptions answer "will this work?" without follow-up questions
- Reviewers understand change scope in under 30 seconds
- Breaking changes are never missed
- Template structure is consistently applied

## Scope

### In Scope
- Unified diff parsing
- PR description generation
- Breaking change detection
- Testing plan suggestion

### Out of Scope
- Code review (reviewing existing PRs)
- Commit message generation
- Changelog generation
- Automated PR creation

## Guarantees

### Must Do
1. Base description on real diffs, not intentions
2. Lead with 1-3 sentence summary
3. Use imperative mood ("Add feature" not "Added")
4. Link issues and context
5. Highlight breaking changes prominently
6. Provide review guidance

### Must Not Do
1. Fabricate changes not in the diff
2. Hide breaking changes
3. Assume invisible context
4. Generate vague summaries
5. Ignore existing PR templates
