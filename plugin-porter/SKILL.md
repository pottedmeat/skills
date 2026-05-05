---
name: plugin-porter
description: Ports a Claude-style plugin folder into another agent harness (Cursor, OpenCode, Agent Zero, Codex CLI, etc.) by scanning for Claude-specific constructs, researching the target harness's conventions, and rewriting files in place. Use when the user asks to "port this plugin to {harness}", "adapt this Claude plugin for {harness}", "convert plugin to {harness}", "install this plugin in {harness}", "migrate plugin to {harness}", "translate plugin for {harness}", or "retarget plugin to {harness}". Do NOT use for creating new skills (use create-skill instead), installing a Claude plugin inside Claude Code itself, or general code refactoring unrelated to plugin format conversion.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# plugin-porter

Ports a Claude-style plugin (skills, agents, commands, hooks, plugin metadata, shared references) into a user-chosen target agent harness using a **document-driven** workflow. A single `port-plan.md` is the only state. The parent skill (this file) and three subagents (scanner, researcher, rewriter) all coordinate through that one document. Each subagent reads its assigned input section and writes its assigned output section. Subagents never return data, never ask questions, and never call `AskUserQuestion` — their terminal message is a one-line confirmation.

## Critical Rules

- All user-facing prompts originate from this skill via `AskUserQuestion`. Subagents lack the tool and have no decision branches that could surface as a prompt — they record needs in `port-plan.md`'s `open_questions` or `blockers` sections instead.
- The skill is a state machine over `port-plan.md`. Every transition is observable in the file. Every state can be resumed from disk.
- Subagent instructions live at `references/agents/{scanner,researcher,rewriter}.md`. Spawn each via `Task` by reading the file and injecting its contents as the prompt, plus the `port_plan_path` and any reference paths.
- `port-plan.md` lives at `./docs/plugin-porter/{plugin-name}/port-plan.md` in the current working directory. Never modify the source plugin. Back up any pre-existing files at the install location.
- The skill is harness-agnostic — the researcher discovers conventions dynamically.

## Workflow

The workflow is a state machine. Read `port-plan.md`'s `status` field after each subagent run to decide the next action.

### Step 1 — Validate source

Source is either:

- An absolute or `~`-expanded local path to a Claude plugin folder.
- A git URL (https or ssh). Clone with `git clone --depth 1 {url} /tmp/plugin-porter-{timestamp}/` and use the clone as `source_path`. The remote is never modified.

Validate by checking for at least one of:

- `plugin.json` at the root
- `skills/` with at least one `SKILL.md`
- `agents/` with at least one agent definition
- `.claude/skills/` (project-skill layout)

Halt if none match.

Derive `plugin_name` from `plugin.json:name` (if present) or the source basename.

### Step 2 — Collect target configuration

Ask the user via `AskUserQuestion` for the **target harness** (free text — do not constrain to a fixed list). This is the only mandatory question.

Silent defaults (do not ask):

- **Install scope**: user-global (the target harness's standard per-user path). Only ask if the source contains references to project-relative paths that cannot resolve without a project context.
- **Documentation hints**: empty. Researcher discovers conventions via WebFetch.
- **Output mode**: in-place write at `install_location` with backups. Do not ask.

Record every silently-defaulted decision — they go into `silent_assumptions` later, surfaced in the final summary.

### Step 3 — Initialize port-plan.md

Create `./docs/plugin-porter/{plugin-name}/` if it doesn't exist.

If `port-plan.md` already exists at that path:

- Read its `meta.source_path` and `meta.target_harness`.
- If they match the current run, ask via `AskUserQuestion` whether to **resume**, **start over**, or **cancel**.
- If resume: skip to Step 5 with the existing file's `status` driving the next action.
- If start over: rename the existing file to `port-plan.md.{timestamp}.bak` and proceed.

Otherwise, create a fresh `port-plan.md` with:

```yaml
status: new
meta:
  plugin_name: <name>
  source_path: <abs path>
  source_kind: local | git
  target_harness: <user input>
  install_location: <derived from harness convention>
  install_scope: user-global
  docs_hints: []
  created_at: <ISO 8601>
  updated_at: <ISO 8601>
findings: []
mappings: []
silent_assumptions: []
open_questions: []
blockers: []
rewrite_log:
  files_written: []
  files_backed_up: []
  todos_inserted: []
  backup_root: null
```

The `install_location` may be a placeholder until the researcher resolves the harness convention; you can update it after Step 5 if needed (and bump `updated_at`).

### Step 4 — Dispatch loop

After each subagent run, re-read `port-plan.md` and dispatch based on `status`:

| `status` | Action |
|----------|--------|
| `new` | Transition to `scanning`. Spawn scanner. → Step 5 |
| `scanning` | (Scanner running.) On termination, transition to `scanned`. Re-enter dispatch. |
| `scanned` | Transition to `researching`. Spawn researcher. → Step 6 |
| `researching` | (Researcher running.) On termination, inspect `open_questions`. If any unanswered, transition to `awaiting-user`. If all answered AND `mappings` covers every finding, transition to `mapped`. Else re-spawn researcher. |
| `awaiting-user` | Surface unanswered questions to user. → Step 7 |
| `mapped` | Transition to `rewriting`. Spawn rewriter. → Step 8 |
| `rewriting` | (Rewriter running.) On termination, transition to `complete`. → Step 9 |
| `complete` | Final summary. → Step 9 |
| `blocked` | A subagent appended to `blockers`. Read the latest `blockers` entry, decide whether to surface to user, auto-remediate, or halt. |

Transitions are written to `status` in `port-plan.md` via `Edit`. Always update `meta.updated_at` when you transition.

### Step 5 — Scan

Transition `status: new → scanning`.

Read `references/agents/scanner.md` and spawn a subagent via `Task` with:

- The full scanner.md contents as the prompt.
- The values: `port_plan_path` (absolute), `taxonomy_path` (absolute, → `references/harness-concepts.md`), `schema_path` (absolute, → `references/port-plan-schema.md`).

Wait for terminal message:

- `findings filled: N entries` → transition `status: scanning → scanned`. Continue dispatch.
- `blocked: <reason>` → transition `status: → blocked`. Read the new `blockers` entry and decide.

### Step 6 — Research

Transition `status: scanned → researching`.

Read `references/agents/researcher.md` and spawn a subagent via `Task` with:

- The full researcher.md contents as the prompt.
- The values: `port_plan_path`, `taxonomy_path`, `decision_taxonomy_path` (→ `references/decision-taxonomy.md`), `schema_path`.

Wait for terminal message:

- `mappings: M, open_questions: K (unanswered: U)` →
  - If `U > 0`: transition `status: researching → awaiting-user`. → Step 7.
  - If `U == 0` and every `finding_id` has a `mappings` entry: transition `status: researching → mapped`. → Step 8.
  - Otherwise (mappings incomplete but no questions): inspect `blockers`; if none, re-spawn researcher (it may have terminated early — give it one retry, then escalate to a `blockers` entry yourself).
- `blocked: <reason>` → transition `status: → blocked`. Handle.

### Step 7 — Surface open questions

For each `open_questions` entry where `answer == null`:

1. Surface the entry via `AskUserQuestion`. Use the entry's `question`, `options` (with `recommended_default` first), and the multi-select / single-select shape appropriate to the entry.
2. Write the user's answer back into the entry's `answer` field via `Edit`. Update `meta.updated_at`.

If the user declines or provides free-text that doesn't match any option, store the free-text verbatim as the answer.

When all entries have `answer != null`:

- Transition `status: awaiting-user → researching`.
- Re-spawn researcher (Step 6). The researcher will consume the answers and finalize mappings.

### Step 8 — Rewrite

Transition `status: mapped → rewriting`.

Before dispatching, finalize `meta.install_location` if it was a placeholder (researcher's mappings should now have authoritative path templates).

Read `references/agents/rewriter.md` and spawn a subagent via `Task` with:

- The full rewriter.md contents as the prompt.
- The values: `port_plan_path`, `schema_path`.

Wait for terminal message:

- `files_written: N, files_backed_up: M, todos_inserted: K` → transition `status: rewriting → complete`.
- `blocked: <reason>` → transition `status: → blocked`. Handle.

### Step 9 — Final summary

Read `port-plan.md` and present to the user:

- **Files written**: count from `rewrite_log.files_written`. List the install location.
- **Files backed up**: count from `rewrite_log.files_backed_up`. Path to backup root if any.
- **TODO markers**: count from `rewrite_log.todos_inserted`. List file paths so the user can resolve manually.
- **Silent assumptions**: enumerate `silent_assumptions` so the user can audit defaulted decisions.
- **Reports directory**: path to `port-plan.md`.
- Reminder: source plugin was not modified; backups (if any) live under `{install_location}/.plugin-porter-backup/{timestamp}/`.

Then ask via `AskUserQuestion` whether there are target-harness quirks worth recording. If yes, append a dated entry to `docs/learnings.md` under the skill directory:

```markdown
## YYYY-MM-DD — {target_harness}

- {quirk}
```

## Handling blockers

When `status: blocked`, read the latest `blockers` entry and route:

- If `what_i_need` describes information the user can provide → surface as an `AskUserQuestion`. Once answered, write the answer into a useful section (likely `meta.docs_hints` or as a new `open_questions` entry with the answer pre-filled), reset `status` to the role's expected entry state, and re-dispatch.
- If `what_i_need` describes a permission/IO problem → halt and report; the user must remediate manually, then resume.
- If the blocker is malformed or vague → halt and surface the raw entry to the user.

## Idempotency and resumability

Every state in the state machine is recoverable from `port-plan.md`. If a run is interrupted:

1. Re-invoke this skill with the same source.
2. Step 3 detects the existing `port-plan.md` and offers resume.
3. Step 4 dispatches based on the file's current `status`.

The rewriter is idempotent: it consults `rewrite_log.files_written` and skips files already processed. The researcher is idempotent on re-invocation: it only writes mappings for `open_questions` that have a populated `answer` AND lack a corresponding mapping.

## Error Handling

- Source not a Claude plugin → halt at Step 1.
- Scanner fails (writes to `blockers`) → present blocker, allow retry.
- Researcher cannot find target docs → it writes an `open_questions` entry asking for a doc URL; parent surfaces it; if the user has none, researcher proceeds with low-confidence mappings.
- Rewriter detects missing mappings → it writes a `blockers` entry listing finding ids; parent halts and reports (this indicates a researcher bug, not a user-fixable issue).
- Install location has permission issues → rewriter writes `blockers`; halt before any writes.

## Why document-driven

A previous version of this skill used RPC-style subagents that returned data via terminal messages. That architecture had a recurring failure: subagents faced unresolved decisions and the harness's interactive-prompt fallback would fire as their terminal message, surfacing prompts the parent could not see or attribute. The document-driven design eliminates that failure mode: subagents have no decision branches that surface to terminal messages, no return values, no AskUserQuestion access. They read assigned sections, write assigned sections, terminate. All user interaction flows through the parent reading `port-plan.md`.
