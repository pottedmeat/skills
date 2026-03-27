# PR Description Skill - Technical Specification

## Architecture

```
Input: Unified Diff
    ↓
Context Gatherer (git log, diff, template)
    ↓
Analysis Engine (classify, assess impact)
    ↓
Breaking Change Detector (pattern matching)
    ↓
Description Generator (apply template)
    ↓
Output: Structured PR Description
```

## Components

### 1. Context Gatherer

Operations:
- `git log <base>..HEAD --oneline` for commit history
- `git diff <base>...HEAD --stat` for file summary
- `git diff <base>...HEAD` for full diff
- Check `.github/PULL_REQUEST_TEMPLATE.md`

### 2. Analysis Engine

Classification logic:
- File path patterns → test/docs/chore
- Code patterns → feature/fix/refactor/perf
- Lines added vs removed → growth vs cleanup

Impact assessment:
- Breaking changes: removed/renamed APIs, signatures
- Deprecations: @deprecated comments
- New features: new exported functions/classes
- Risks: concurrent code, security areas

### 3. Breaking Change Detector

Pattern matching for:
- Removed public functions/classes
- Renamed identifiers
- Changed signatures (params, return types)
- Required new parameters
- Schema/config changes

### 4. Description Generator

Template resolution:
1. Use existing PR template if found
2. Otherwise use default template
3. Fill sections from analysis

Section generation:
- Summary: synthesized from commits + diff
- Changes: extracted from diff stats + grouping
- Context: commit messages, issues
- Testing: test file changes + inference
- Breaking Changes: API diff analysis

## Performance

| Operation | Time |
|-----------|------|
| Context gathering | <2s |
| Diff analysis | <5s |
| Generation | <1s |
| Total | <10s |

## Edge Cases

- Large PRs (>2000 lines): Note size, focus review guidance
- Merge commits: Warn about complex history
- Binary files: List names, note not analyzed
- Renamed files: Show as "Rename X → Y"
