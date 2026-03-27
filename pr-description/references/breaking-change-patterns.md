# Breaking Change Detection Patterns

## API Surface Changes

| Pattern | Breaking | Example |
|---------|----------|--------|
| Remove public function | Yes | `def foo():` removed |
| Remove public class | Yes | `class Client:` removed |
| Rename identifier | Yes | `.timeout` → `.requestTimeout` |
| Add required parameter | Yes | `foo(a)` → `foo(a, b)` |
| Remove parameter | Yes | `foo(a, b)` → `foo(a)` |
| Change parameter type | Maybe | `int` → `str` |
| Change return type | Maybe | `→ int` → `→ str` |
| Add optional parameter | No | `foo(a)` → `foo(a, b=None)` |

## Behavioral Changes

| Pattern | Breaking | Detection |
|---------|----------|----------|
| Stricter validation | Maybe | Added `raise ValueError` |
| Changed error type | Maybe | Different exception |
| Changed default | Maybe | `timeout=None` → `timeout=30` |
| Removed side effect | Maybe | No longer writes log |

## Configuration/Schema Changes

| Pattern | Breaking | Detection |
|---------|----------|----------|
| Remove config option | Yes | Option no longer read |
| Rename config option | Yes | Key renamed |
| Require new config | Maybe | New required field |
| Schema modification | Yes | ALTER TABLE patterns |

## Severity Classification

### Critical
- Removed API with no migration path
- Changed semantics (same API, different meaning)
- Required new dependencies

### Moderate
- Renamed API (search-replace fixes)
- New required parameter with default available
- Changed defaults (can restore with config)

### Minor
- Internal API changes
- Error type changes
- Performance characteristics

## Detection Heuristics

Regex patterns to flag:
```regex
-.*(?:public|export|def |class |func )
-.*\([^)]+\).*→.*\([^)]*\)
-renamed?.*from\s+['"]?(\w+)
```

Semantic patterns:
- "Remove"/"Delete" in commit → check public API
- "Rename" in commit → check public API
- "Change" + "default" → check behavior diff
