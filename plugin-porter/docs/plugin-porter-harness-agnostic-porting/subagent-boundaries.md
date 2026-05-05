# Subagent User-Interaction Boundaries

## Purpose

The plugin-porter skill isolates **all** user interaction at the parent
(`SKILL.md`) level. The three subagents — scanner, researcher, rewriter —
must never prompt the user. They communicate ambiguity exclusively through
document writes to `port-plan.md` (`open_questions`, `blockers`,
`silent_assumptions`). This document audits each subagent instruction file
against the five enforcement points defined in `docs/spec.md` § Validation
Strategy, and tracks the design intent recorded in `docs/contract.md`
under "User-interaction boundary".

This boundary exists because past iterations of the skill suffered from
subagents prompting the user via the harness's interactive-prompt fallback
when their terminal messages contained questions or open-ended phrasing.
The fix: make the subagent's job purely mechanical (read assigned input
section, write assigned output section, terminate with a fixed one-line
confirmation), so the harness has nothing to fire a prompt on.

## The Five Enforced Constraints

Per `docs/spec.md` § Validation Strategy, each agent instruction file
must explicitly state:

1. It does not call `AskUserQuestion` (and does not have it).
2. Which sections of `port-plan.md` it is allowed to write.
3. That its terminal message is a one-line confirmation, with the exact
   format specified.
4. That its escape hatch when stuck is appending to `blockers`.
5. That these constraints are concrete and enforceable (named sections,
   exact strings, named tools — not vague guidance).

## Compliance Matrix

Columns: scanner | researcher | rewriter.
Rows: the five constraints above.
Each cell quotes the verbatim line(s) from the agent file that satisfy
the constraint, with line references in the form
`{file}:{line}`.

### 1. Forbids `AskUserQuestion` explicitly

| Agent | Evidence |
| ----- | -------- |
| **scanner** | `scanner.md:11` — "You do not return data. You do not ask questions. You do not call AskUserQuestion (you don't have it)." Reinforced under `## Forbidden` at `scanner.md:74`: "Calling AskUserQuestion (you do not have it)." |
| **researcher** | `researcher.md:11` — "You do not return data. You do not ask questions. You do not call AskUserQuestion (you don't have it)." Reinforced under `## Forbidden` at `researcher.md:112`: "Calling AskUserQuestion (you do not have it)." |
| **rewriter** | `rewriter.md:11` — "You do not return data. You do not ask questions. You do not call AskUserQuestion (you don't have it)." Reinforced under `## Forbidden` at `rewriter.md:152`: "Calling AskUserQuestion (you do not have it)." |

All three agents satisfy this constraint with two redundant statements
(opening paragraph + Forbidden section). The parenthetical "(you don't
have it)" doubles as a tool-availability claim — backed by the YAML
`tools:` frontmatter in each file, which omits `AskUserQuestion`:

- `scanner.md:4` → `tools: Read, Glob, Grep, Edit`
- `researcher.md:4` → `tools: Read, WebFetch, Edit`
- `rewriter.md:4` → `tools: Read, Write, Edit, Bash, Glob`

### 2. Specifies allowed sections to write

| Agent | Evidence |
| ----- | -------- |
| **scanner** | `scanner.md:29-35` (`## Sections you may write`): "`findings` (your owned section, append entries until scan is complete). / `blockers` (append an entry only if you cannot proceed; then terminate immediately). / `meta.updated_at` (update on every write). / You must NOT write any other section. Doing so is a contract violation." |
| **researcher** | `researcher.md:32-40` (`## Sections you may write`): "`mappings` (your primary owned section). / `silent_assumptions` (append-only). / `open_questions` (write entries with `answer: null`; never modify the `answer` field — that is the parent's responsibility). / `blockers` … / `meta.updated_at` …" plus the explicit "You must NOT write any other section. You must NOT modify entries in `findings`. You must NOT fill or modify `open_questions[].answer`." |
| **rewriter** | `rewriter.md:93-100` (`## Sections you may write`): "`rewrite_log` (your primary owned section). / `silent_assumptions` (append-only — for assumptions you make during rewrite…). / `blockers` … / `meta.updated_at` …" plus "You must NOT write any other section. You must NOT modify `findings`, `mappings`, or `open_questions`." |

All three lists match the section-ownership table in `docs/spec.md`
§ "Section ownership". Each file pairs a positive list ("may write")
with an explicit negative ("must NOT write any other section"),
which makes the constraint enforceable by static inspection of an
edit log.

### 3. Specifies terminal-message format (one-line confirmation)

Each agent declares its success and failure terminal messages in two
places: an early prose statement and a dedicated `## Termination`
section.

| Agent | Success format | Failure format | Source |
| ----- | -------------- | -------------- | ------ |
| **scanner** | `findings filled: N entries` | `blocked: <one-line reason>` | `scanner.md:11`, `scanner.md:82-86` |
| **researcher** | `mappings: M, open_questions: K (unanswered: U)` | `blocked: <one-line reason>` | `researcher.md:11`, `researcher.md:117-122` |
| **rewriter** | `files_written: N, files_backed_up: M, todos_inserted: K` | `blocked: <one-line reason>` | `rewriter.md:11`, `rewriter.md:170-175` |

Each `## Termination` section closes with the same enforcement coda:
"Nothing else. No questions. No prose."
(`scanner.md:87`, `researcher.md:124`, `rewriter.md:177`.)

This three-line coda is the strongest enforcement signal in the files —
it explicitly names the failure mode (questions, prose) the constraint
is designed to prevent.

### 4. Specifies escape hatch (append to `blockers`) when stuck

| Agent | Evidence |
| ----- | -------- |
| **scanner** | Dedicated `## When to write a blockers entry` section at `scanner.md:64-70` enumerates three triggers (source path missing, wrong status, hard read error). Closes with: "In every case: append the blocker, do not write a partial `findings` section, terminate." Also referenced in workflow step 1 (`scanner.md:39`). |
| **researcher** | Dedicated `## When to write a blockers entry` section at `researcher.md:103-108`: "Target harness docs are completely unreachable AND `meta.docs_hints` is empty AND you have already written an `open_questions` asking for hints in a prior pass. / The schema-required structure of `port-plan.md` is malformed in a way you cannot recover from." Closes with: "In every case: append the blocker, terminate." |
| **rewriter** | Dedicated `## When to write a blockers entry` section at `rewriter.md:142-148`: lists three triggers (missing mappings, unwriteable install location, backup failure). Closes with: "In every case: append the blocker, leave partial work in place, terminate." |

Each agent has named, observable trigger conditions for `blockers`,
not vague "when stuck" guidance. The researcher additionally enforces
a precondition (must have already exhausted `open_questions`) before
escalating to `blockers`, which keeps the questioning channel as the
primary escape hatch and `blockers` as a true last resort.

### 5. Constraints are concrete and enforceable

The ratchet-test for "concrete vs. vague": can a static checker verify
the constraint was honored without re-running the agent?

| Agent | Concreteness evidence |
| ----- | --------------------- |
| **scanner** | (a) Forbidden actions listed by name (`scanner.md:73-78`): writing to `mappings`, `open_questions`, `silent_assumptions`, `rewrite_log`, or `status`; modifying anything under `meta.source_path`. (b) Terminal message is an exact string template with one numeric variable. (c) Allowed write surface is three named keys. |
| **researcher** | (a) Forbidden actions listed by name (`researcher.md:110-115`): modifying `findings`, `rewrite_log`, `status`, or any `open_questions[].answer` field. (b) Open-question entry shape is given as a literal YAML template (`researcher.md:87-99`). (c) "Guessing a mapping you are uncertain about" is forbidden by name, with the prescribed alternative ("use `open_questions` instead"). |
| **rewriter** | (a) Forbidden actions listed by name (`rewriter.md:150-160`): modifying `findings`/`mappings`/`open_questions`; modifying anything under `meta.source_path`; overwriting without backing up; writing outside the install layout; copying skip-list files; injecting a path-variables prose block. (b) Terminal message is an exact string template with three numeric variables. (c) Install layout is given as a literal directory tree (`rewriter.md:35-45`) so any out-of-tree write is detectable. |

All three are enforceable by post-hoc inspection of the diff between
the pre-run and post-run `port-plan.md` plus the install-location
filesystem. None of the constraints rely on "best effort" or
"reasonable judgment" language.

## Gaps

This section lists residual ambiguity or missing constraints discovered
during the audit. None block the boundary's correctness, but each is
worth tracking.

### G1. "Asking the user" appears twice but is never operationally defined

Each `## Forbidden` block lists, separately:

- "Calling AskUserQuestion (you do not have it)."
- "Asking the user anything in your terminal message."

(`scanner.md:74-75`, `researcher.md:112-113`, `rewriter.md:152-153`.)

The second bullet is the one that targets the historical bug (terminal
messages with questions triggering a harness fallback prompt). It is
reinforced by the `Nothing else. No questions. No prose.` coda in each
`## Termination` block, but the term "asking" is not defined. A
question-shaped terminal message that omits a literal `?` (e.g.
"unclear what to do — please advise") could plausibly evade a
naïve check.

**Mitigation already present**: the success-message templates are exact
strings, and the failure message is constrained to `blocked: <one-line reason>`,
which leaves no syntactic room for a question. Static enforcement is
therefore: terminal message must match one of the two templates verbatim.

### G2. Researcher's `blockers` precondition is sequential and stateful

`researcher.md:103-105` requires the researcher, before writing a
`blockers` entry for unreachable docs, to have *previously* written an
`open_questions` entry asking for `docs_hints`. This is a multi-run
invariant: the agent on its first invocation has nothing to check
against. The instruction relies on the researcher inspecting prior
`open_questions` entries on re-invocation. This is correct under the
state-machine flow described in `docs/spec.md`, but the file does not
explicitly say "if this is your first run, you may not yet write a
docs-unreachable blocker — write the open_question first." A reader
must infer that from the conjunction `AND you have already written…`.

### G3. Scanner's `meta.updated_at` write is technically a write outside its primary section

All three agents are permitted to update `meta.updated_at`
(`scanner.md:33`, `researcher.md:38`, `rewriter.md:98`), but the broader
"You must NOT write any other section" prohibition uses the word
"section". `meta` is a section per `docs/spec.md` § Section ownership
("`meta` … owner: parent"). The agent files resolve this by carving out
`meta.updated_at` as the single permitted field, but a strict reading
of the section-ownership table would flag this as a contract violation.
The carve-out is consistent across all three files, so this is more of
a documentation-clarity gap than a behavioral one.

### G4. No agent file references `docs/spec.md` § Validation Strategy by name

The five constraints audited here come from `docs/spec.md:148`. None of
the three agent files cites that source. If the spec's enforcement
points are revised, the agent files will not automatically reflect the
change. Consider adding a one-line back-reference at the top of each
agent file (e.g. "Constraints enforced per `docs/spec.md` § Validation
Strategy.").

### G5. Tool whitelist is the only mechanism preventing AskUserQuestion access

The claim "you don't have it" is enforced by the YAML `tools:`
frontmatter (e.g. `scanner.md:4`). If a future edit adds
`AskUserQuestion` to that list — or if the harness ignores the
whitelist — the prose constraint becomes the only line of defense. The
prose constraint is strong (mentioned twice per file plus the
termination coda), but a defense-in-depth check would be: a
pre-dispatch validator in `SKILL.md` that asserts each agent's tools
frontmatter does not contain `AskUserQuestion`.

## Cross-References

- `docs/spec.md` § Validation Strategy — defines the five enforcement
  points (the column headers of the matrix above).
- `docs/spec.md` § Skill Architecture → "User-interaction boundary"
  paragraph — design rationale for why subagents must not prompt.
- `docs/spec.md` § "Why this eliminates the prompting bug" — historical
  context: the harness's interactive-prompt fallback fired on
  question-shaped terminal messages, so the fix is to remove all
  decision branches from terminal messages.
- `docs/contract.md` — "User-interaction boundary" design decision
  (referenced in this story; consult that file for first-principles
  rationale).
- `references/port-plan-schema.md` — section names and ownership table
  that the agent `## Sections you may write` blocks must align with.

## Verdict

All three subagent instruction files satisfy all five enforced
constraints with concrete, statically-checkable evidence. The boundary
is intact in the source-of-truth files. Gaps G1–G5 are documentation
polish and defense-in-depth opportunities, not boundary violations.
