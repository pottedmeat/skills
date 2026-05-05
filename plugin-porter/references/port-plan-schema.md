# port-plan.md — Document Schema

`port-plan.md` is the single source of truth for a plugin-porter run. The parent skill creates it at `./docs/plugin-porter/{plugin_name}/port-plan.md`. The parent and three subagents (scanner, researcher, rewriter) all read and write to assigned sections of this one file. No other state is kept anywhere; resumability is "open the file, read `status`, dispatch the next role."

## File layout

The document has a YAML block at the top (delimited by `---` lines) followed by a human-readable Markdown summary the parent maintains for the user. Subagents read and write the YAML block; the parent regenerates the human summary after each subagent run.

```markdown
---
status: <state>
meta:
  plugin_name: <string>
  source_path: <abs path>
  source_kind: local | git
  target_harness: <string>
  install_location: <abs path>
  install_scope: project | user-global
  docs_hints: [<url>, ...]
  created_at: <ISO 8601>
  updated_at: <ISO 8601>

findings:
  - id: F001
    category: <one of 12 taxonomy categories>
    file: <relative path under source_path>
    line: <int or null>
    construct: <short identifier, e.g. "${CLAUDE_PLUGIN_ROOT}">
    raw_snippet: <≤200 chars, ellipsized>
  - ...

mappings:
  - finding_id: F001
    target_construct: <string or structured object>
    confidence: high | medium | low
    notes: <string>
  - ...

silent_assumptions:
  - category: <tool-rename | prose-rewrite | frontmatter-mechanical | plugin-json-passthrough | marketplace-drop | install-scope | config-recommend-only | foreign-harness-artifact | setup-script-port | ...>
    finding_id: <Fxxx or null for cross-cutting>
    assumption: <one-line description>
    taxonomy_ref: <section in decision-taxonomy.md>

open_questions:
  - id: Q001
    category: <ambiguous-mapping | missing-concept | config-edit | docs-unreachable>
    finding_id: <Fxxx or null>
    question: <prose, multi-line allowed>
    options:
      - <string>
      - <string>
    recommended_default: <one of options or free text>
    answer: <null until parent fills>

blockers:
  - role: scanner | researcher | rewriter
    timestamp: <ISO 8601>
    reason: <prose>
    what_i_need: <prose — what would unblock this role>

rewrite_log:
  files_written: [<relative path>, ...]
  files_backed_up:
    - source: <relative path under install_location>
      backup: <abs path under .plugin-porter-backup/{ts}/>
  todos_inserted:
    - file: <relative path under install_location>
      finding_id: <Fxxx>
      reason: <string>
  backup_root: <abs path or null>
---

# Port Plan: {plugin_name} → {target_harness}

(Human-readable summary maintained by the parent. Sections mirror the YAML
block but in narrative form. Subagents do NOT touch this part.)
```

## Section ownership

| Section | Writer(s) | Readers |
|---------|-----------|---------|
| `status` | parent (transitions). Subagents may NOT write `status` directly; if a subagent cannot proceed, it appends to `blockers` and terminates, and the parent decides whether to flip `status` to `blocked`. | all |
| `meta` | parent (initial); parent (updates `updated_at` per write) | all |
| `findings` | scanner (write-once; append-only during scan) | researcher, rewriter, parent |
| `mappings` | researcher (write + update on re-invocation) | rewriter, parent |
| `silent_assumptions` | researcher (initial); rewriter (append-only) | parent |
| `open_questions` | researcher (writes entries with `answer: null`); parent (writes `answer` values via Edit) | researcher (re-invocation reads answers) |
| `blockers` | any role (append-only) | parent |
| `rewrite_log` | rewriter | parent |

A subagent attempting to write outside its owned sections is a contract violation. Each subagent's instruction file enumerates its allowed sections explicitly.

## Status state machine

```
new ──▶ scanning ──▶ scanned ──▶ researching ──▶ awaiting-user
                                       ▲              │
                                       └──────────────┘
                                       │
                                       ▼
                                     mapped ──▶ rewriting ──▶ complete

any state ──▶ blocked   (when blockers section gains an entry the parent escalates)
```

| From | To | Trigger |
|------|-----|---------|
| `new` | `scanning` | parent dispatches scanner |
| `scanning` | `scanned` | scanner terminates with `findings` non-empty (or empty + note) |
| `scanned` | `researching` | parent dispatches researcher |
| `researching` | `awaiting-user` | researcher terminates with at least one `open_questions[].answer == null` |
| `awaiting-user` | `researching` | parent has filled all `open_questions[].answer` and re-dispatches researcher |
| `researching` | `mapped` | researcher terminates with all `open_questions` answered AND `mappings` covers every `finding_id` |
| `mapped` | `rewriting` | parent dispatches rewriter |
| `rewriting` | `complete` | rewriter terminates with `rewrite_log` populated |
| any | `blocked` | parent observes a new `blockers` entry that cannot be auto-remediated |

## Per-section schemas

### findings entry

```yaml
- id: F001                  # zero-padded sequential, unique per document
  category: <string>        # exact name from references/harness-concepts.md
  file: <relative path>     # relative to meta.source_path
  line: <int|null>          # null when finding is whole-file (e.g. plugin.json)
  construct: <string>       # short identifier ("${CLAUDE_PLUGIN_ROOT}", "Read", "opus")
  raw_snippet: <string>     # ≤200 chars; truncate with ellipsis
```

### mappings entry

```yaml
- finding_id: F001
  target_construct: <string|object>
  confidence: high|medium|low
  notes: <string>
```

When the mapping requires structural change (e.g. per-agent tool list flattening to a global allowlist), `target_construct` is an object describing the structured translation.

### silent_assumptions entry

```yaml
- category: <string>        # see decision-taxonomy.md categories
  finding_id: <Fxxx|null>
  assumption: <string>
  taxonomy_ref: <string>    # citation to a section/heading in decision-taxonomy.md
```

### open_questions entry

```yaml
- id: Q001                  # zero-padded sequential, unique per document
  category: ambiguous-mapping|missing-concept|config-edit|docs-unreachable
  finding_id: <Fxxx|null>
  question: <string>        # multi-line prose
  options:                  # 2–4 strings
    - <string>
  recommended_default: <string>
  answer: <string|null>     # null until parent fills
```

### blockers entry

```yaml
- role: scanner|researcher|rewriter
  timestamp: <ISO 8601>
  reason: <string>
  what_i_need: <string>
```

A blocker is the universal escape hatch: any subagent that cannot proceed for any reason (unreachable doc, malformed source, permission error, contract violation it detected) appends a `blockers` entry and terminates. The parent reads `blockers` after each subagent run and decides:

- Surface to user as a question (if `what_i_need` is a piece of information).
- Auto-remediate (e.g. recreate a missing file).
- Halt and report.

### rewrite_log

```yaml
rewrite_log:
  files_written:
    - <relative path under install_location>
  files_backed_up:
    - source: <relative path under install_location>
      backup: <abs path>
  todos_inserted:
    - file: <relative path>
      finding_id: <Fxxx>
      reason: <string>
  backup_root: <abs path or null>
```

## Editing rules

- Use Edit (not Write) to mutate `port-plan.md`. The file accumulates state across multiple subagent invocations; rewriting it from scratch destroys other roles' contributions.
- Append to lists (`findings`, `silent_assumptions`, `open_questions`, `blockers`) using surgical Edit: locate the closing `]` (or last entry) and insert before it.
- Update `meta.updated_at` on every write. The role doing the write is responsible for this.
- Subagents must verify `status` matches their expected entry state on startup. If `status` is not what they expect (e.g. researcher invoked when `status: scanning`), they append a `blockers` entry and terminate.

## Resumability

A run can be resumed at any time by reading `port-plan.md`:

- `status: scanning` → re-dispatch scanner.
- `status: scanned` → dispatch researcher.
- `status: researching` → check `open_questions`; if any `answer: null`, surface to user; else re-dispatch researcher to finalize.
- `status: awaiting-user` → surface unanswered questions to user.
- `status: mapped` → dispatch rewriter.
- `status: rewriting` → re-dispatch rewriter (rewriter is idempotent: it consults `rewrite_log` to skip already-written files).
- `status: complete` → display summary.
- `status: blocked` → present `blockers` to user.
