# plugin-porter — Spec

## Component Manifest

| File | Purpose |
| ---- | ------- |
| `SKILL.md` | Entry point and orchestrator. Owns the `port-plan.md` lifecycle: creates it, transitions `status`, dispatches subagents, surfaces `open_questions` and `blockers` to the user, finalizes mappings. The ONLY place that calls `AskUserQuestion`. |
| `docs/contract.md` | Design intent. |
| `docs/spec.md` | This file. Execution plan. |
| `docs/learnings.md` | Per-harness observations from retrospective runs. |
| `references/agents/scanner.md` | Subagent instructions: read source plugin, fill `findings` section of `port-plan.md`. No decisions, no questions, no return value. |
| `references/agents/researcher.md` | Subagent instructions: read `findings` + answered `open_questions`, fill/update `mappings`, `silent_assumptions`, and `open_questions` sections of `port-plan.md`. No AskUserQuestion. |
| `references/agents/rewriter.md` | Subagent instructions: read finalized `mappings`, produce ported files at install location, fill `rewrite_log` section. No AskUserQuestion. |
| `references/harness-concepts.md` | Reference taxonomy of Claude plugin concepts that need porting. |
| `references/decision-taxonomy.md` | Harness-agnostic silent-default / ask-rarely / always-ask categorization. Researcher consults it; parent uses it for surfacing decisions. |
| `references/port-plan-schema.md` | Structural contract for `port-plan.md`: section names, ownership (which role writes which section), valid `status` transitions, schemas for findings/mappings/open_questions/blockers entries. Replaces the previous separate scanner-report/researcher-report/rewriter-summary schemas. |
| `trigger-tests.md` | 20 trigger queries (10 should-trigger, 10 should-not-trigger). |

## Skill Architecture

**Coordination model**: document-driven. A single `port-plan.md` at `./docs/plugin-porter/{plugin-name}/port-plan.md` is the only state. The parent and the three subagents all read and write to assigned sections of this one file. No subagent returns data via its terminal message; no subagent calls `AskUserQuestion`. The terminal message of every subagent is a one-line confirmation that it finished writing its section.

**State machine**: `port-plan.md` has a top-level `status` field that drives the workflow:

```
new → scanning → scanned → researching → awaiting-user → researching → ... → mapped → rewriting → complete
                                              ↑                  ↓
                                              └──── (parent loop) ┘
```

Transitions:

| From | To | Trigger |
|------|-----|---------|
| `new` | `scanning` | parent dispatches scanner |
| `scanning` | `scanned` | scanner finishes filling `findings` |
| `scanned` | `researching` | parent dispatches researcher |
| `researching` | `awaiting-user` | researcher writes `open_questions` with non-null entries |
| `awaiting-user` | `researching` | parent fills `open_questions[].answer` and re-dispatches researcher |
| `researching` | `mapped` | researcher writes report with all `open_questions` answered |
| `mapped` | `rewriting` | parent dispatches rewriter |
| `rewriting` | `complete` | rewriter finishes filling `rewrite_log` |
| any | `blocked` | any role appends to `blockers` and terminates |

**User-interaction boundary**: only the parent reads `open_questions` and `blockers` and surfaces them. Subagents have no need to ask the user because their job is purely "read assigned input section, write assigned output section, terminate." If a subagent cannot complete its section, it appends to `blockers` and terminates — the parent then decides whether to surface to the user or remediate.

**Section ownership** (enforced by subagent instructions; subagents must not write outside their owned sections):

| Section | Owner | Reader(s) |
|---------|-------|-----------|
| `meta` (plugin name, source path, target harness, install location, timestamps) | parent | all |
| `status` | parent (transitions); subagents may flip to `blocked` only via the `blockers` write | all |
| `findings` | scanner | researcher, rewriter, parent |
| `mappings` | researcher | rewriter, parent |
| `silent_assumptions` | researcher (initial), rewriter (may append) | parent (for audit) |
| `open_questions` | researcher (writes entries with `answer: null`); parent (writes `answer` values) | researcher (consumes answers on re-invocation) |
| `blockers` | any role (append-only) | parent |
| `rewrite_log` | rewriter | parent |

**Agent team structure**: three sonnet subagents coordinated by the parent. Each spawned via `Task` with `references/agents/{name}.md` injected as the prompt plus the path to `port-plan.md` and the plugin source.

**Data flow** (replaces the previous return-value RPC flow):

1. Parent validates source, derives `plugin_name`, asks user for `target_harness`, creates `port-plan.md` with `status: new` and meta populated.
2. Parent transitions `status: scanning`, spawns scanner with `port-plan.md` path. Scanner reads `meta.source_path`, fills `findings`, terminates.
3. Parent verifies `findings` is populated, transitions `status: scanned`. (If scanner appended to `blockers`, parent surfaces.)
4. Parent transitions `status: researching`, spawns researcher with `port-plan.md` path. Researcher reads `findings` and `meta.target_harness`, does WebFetch research, fills `mappings`, `silent_assumptions`, and `open_questions`. Terminates.
5. Parent inspects `open_questions`. If any entry has `answer: null`, parent transitions `status: awaiting-user`, surfaces each entry via `AskUserQuestion` (using `question`, `options`, `recommended_default` from the entry), and writes `answer` values back into the same file via `Edit`.
6. Parent transitions back to `status: researching`, re-spawns researcher. Researcher reads `open_questions` (now with answers populated), updates `mappings` accordingly, may append `silent_assumptions`. Terminates.
7. Steps 5–6 loop until researcher returns and all `open_questions` have `answer != null`. Parent transitions `status: mapped`.
8. Parent transitions `status: rewriting`, spawns rewriter with `port-plan.md` path. Rewriter reads `mappings`, executes file operations to install location, fills `rewrite_log`. Terminates.
9. Parent transitions `status: complete`, presents final summary to user (including `silent_assumptions` for audit and `rewrite_log.todos_inserted` for manual cleanup).

**Why this eliminates the prompting bug**: subagents have no decision branches that surface to terminal messages. Their job is mechanical: read section X, write section Y, terminate. The only ambiguity-handling output they produce is a structured entry in `open_questions` or `blockers` — both are document writes, not messages. The harness's interactive-prompt fallback has nothing to fire on because the subagent has no terminal-message question to ask.

## Per-Component Details

### SKILL.md

- **Purpose**: Orchestrates the full workflow via the `port-plan.md` state machine.
- **Key behaviors**: Validates source; clones git URLs to tmp; creates `port-plan.md` with initial `meta` and `status: new`; manages all `status` transitions; dispatches subagents; reads `open_questions` and `blockers` after each subagent run; surfaces user-facing prompts via `AskUserQuestion`; writes user answers back into `port-plan.md`; presents final summary including silent assumptions audit.
- **Model**: inherits from session
- **Size estimate**: ~250 lines (smaller than before because the data flow is simpler)

### references/agents/scanner.md

- **Purpose**: Subagent. Read `meta.source_path` from `port-plan.md`, scan recursively, fill the `findings` section.
- **Key behaviors**: Loads `harness-concepts.md` and `port-plan-schema.md`; uses Read/Glob/Grep on source; classifies findings into the thirteen taxonomy categories; appends each finding as a structured entry to the `findings` section via Edit; terminal message: `findings filled: N entries`.
- **Tools**: Read, Glob, Grep, Edit
- **Forbidden**: writing to any section other than `findings` (and `blockers` if it cannot proceed); calling AskUserQuestion (does not have it).

### references/agents/researcher.md

- **Purpose**: Subagent. Read `findings` and `meta.target_harness` from `port-plan.md`, research target harness via WebFetch, fill `mappings`, `silent_assumptions`, and `open_questions`. On re-invocation, also read `open_questions[].answer` values and finalize.
- **Key behaviors**: Loads `harness-concepts.md`, `decision-taxonomy.md`, `port-plan-schema.md`; WebFetches target docs (using `meta.docs_hints` if present); for each finding, applies a silent default per taxonomy or records an `open_questions` entry; on re-invocation, consumes populated answers and updates `mappings`; terminal message: `mappings: N, open_questions: M (unanswered: K)`.
- **Tools**: Read, WebFetch, Edit
- **Forbidden**: writing outside `mappings`, `silent_assumptions`, `open_questions`, `blockers`; calling AskUserQuestion (does not have it).

### references/agents/rewriter.md

- **Purpose**: Subagent. Read finalized `mappings` from `port-plan.md`, produce ported files at `meta.install_location`, fill `rewrite_log`.
- **Key behaviors**: Verifies `status == rewriting` before running; iterates source files; applies mappings (path vars, tool names, model names, frontmatter rewrites); backs up conflicting destination files; writes new files; appends each operation to `rewrite_log`; terminal message: `files_written: N, files_backed_up: M, todos_inserted: K`.
- **Tools**: Read, Write, Edit, Bash, Glob
- **Forbidden**: writing outside `rewrite_log`, `silent_assumptions` (append-only), `blockers`; calling AskUserQuestion (does not have it).

### references/port-plan-schema.md

- **Purpose**: Structural contract for `port-plan.md`. Replaces the previous separate scanner/researcher/rewriter report schemas.
- **Content**: YAML frontmatter (or top-level YAML block) with `status`, `meta`, `findings`, `mappings`, `silent_assumptions`, `open_questions`, `blockers`, `rewrite_log`. Per-section schemas for entries. Section ownership table (which role writes which section). Valid `status` transitions.

### references/harness-concepts.md

Unchanged. Twelve-category taxonomy.

### references/decision-taxonomy.md

Unchanged in structure. New entries to add per learnings (foreign-harness artifacts, setup.sh port pattern, AGENTS.md install-location awareness) — see Phase 5 below.

## Execution Plan

### Phase 1: Schema (foundational)

- `references/port-plan-schema.md` — defines the document structure all other components depend on.

### Phase 2: Subagent instruction rewrites (depends on Phase 1)

- `references/agents/scanner.md` — rewritten for document-driven flow.
- `references/agents/researcher.md` — rewritten for document-driven flow.
- `references/agents/rewriter.md` — rewritten for document-driven flow.

### Phase 3: Parent SKILL.md rewrite (depends on Phase 2)

- `SKILL.md` — rewritten for state-machine orchestration over `port-plan.md`.

### Phase 4: Taxonomy additions (parallelizable)

- `references/decision-taxonomy.md` — add: foreign-harness artifact silent default, setup.sh port pattern, AGENTS.md install-location awareness, PreToolUse Bash hook → permission rules pattern.

### Phase 5: Migration cleanup

- Delete (or mark deprecated) the section in `references/report-schemas.md` that defines the old three-report schemas; either repurpose the file as a redirect to `port-plan-schema.md` or remove and update references.

## Validation Strategy

- Structural: SKILL.md frontmatter valid, name is kebab-case, description ≤1024 chars with third-person + triggers + negative cases, SKILL.md ≤500 lines.
- Anti-pattern scan: first-person prose, vague descriptions, missing trigger phrases.
- Spec compliance: every file in the component manifest exists; no unexpected files; deprecated `report-schemas.md` either removed or redirected.
- Domain-specific: each agent instruction file must explicitly state (1) which sections of `port-plan.md` it owns, (2) which sections it reads, (3) that it must not call AskUserQuestion, (4) that its terminal message is a one-line confirmation, (5) that its escape hatch when stuck is appending to `blockers`.
- Trigger tests: regenerate `trigger-tests.md` if description changes.

## Retrospective Configuration

- **Recommendation**: lightweight (unchanged).
- **Components**: `docs/learnings.md` (already exists). Soft instruction in SKILL.md's final step: append per-harness observations after a successful port.
