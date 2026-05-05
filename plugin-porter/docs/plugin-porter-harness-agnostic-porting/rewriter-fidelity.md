# Rewriter Fidelity to Mappings

This document audits the rewriter subagent (`references/agents/rewriter.md`)
against the rewrite categories the spec promises and against the
operational guarantees stated in `docs/contract.md` Success Criteria,
`docs/spec.md` § rewriter Per-Component Details, and `SKILL.md` Step 8 /
§ Idempotency. It is a durable reference for understanding what the
rewriter does, what it owns in `port-plan.md`, and where its current
behavior may diverge from the contract.

## Role at a glance

The rewriter is the third and final subagent in the document-driven
pipeline. It runs only when `status == rewriting`, consumes finalized
`mappings` from `port-plan.md`, and produces ported files under
`meta.install_location`. It does not return data, does not call
`AskUserQuestion` (it does not have it), and emits a single terminal
line: `files_written: N, files_backed_up: M, todos_inserted: K` on
success or `blocked: <reason>` on failure.

## Operations contract

### Inputs

| Input | Source | Notes |
|-------|--------|-------|
| `port_plan_path` | Parent's spawn prompt | Absolute path to `port-plan.md`. |
| `schema_path` | Parent's spawn prompt | Absolute path to `references/port-plan-schema.md`. |
| `meta.source_path` | `port-plan.md` | Read-only source plugin. |
| `meta.install_location` | `port-plan.md` | Destination root. |
| `meta.target_harness` | `port-plan.md` | Used for path/convention selection. |
| `findings` | `port-plan.md` (scanner-owned) | Every Claude-specific construct. |
| `mappings` | `port-plan.md` (researcher-owned) | One entry per `finding_id`. |

### Outputs (sections owned/written)

| Section | Write mode | Purpose |
|---------|-----------|---------|
| `rewrite_log` | Primary owned section | `files_written`, `files_backed_up`, `todos_inserted`, `backup_root`. |
| `silent_assumptions` | Append-only | Rewriter-time assumptions (e.g. file-mode preservation, path-variable substitution table, plugin-repo metadata skips, MCP conflicts). |
| `blockers` | Append-only, terminate after | When the rewriter cannot proceed. |
| `meta.updated_at` | Update on every write | Timestamp bump. |

The rewriter MUST NOT write to `findings`, `mappings`, `open_questions`,
or `status`. It writes `blockers` to escape; the parent owns the actual
flip to `status: blocked`.

### Side effects on the filesystem

- Creates files under `meta.install_location` according to the
  install layout (skills/, commands/, hooks/, references/,
  `.config/{plugin-name}/`).
- Creates a backup directory at
  `{install_location}/.plugin-porter-backup/{timestamp}/{relative-path}`
  for any pre-existing destination file before overwrite.
- Merges MCP server entries into the target harness's project-scope
  config file (the only sanctioned write outside the install-location
  subtree).
- Never mutates anything under `meta.source_path`.

## Rewrite-category coverage

The table below maps every rewrite the spec/contract implies onto the
rewriter's actual instructions in `references/agents/rewriter.md`,
along with the source-of-truth for each transformation.

| # | Category | Spec/contract reference | Rewriter coverage | Source of truth |
|---|----------|------------------------|-------------------|-----------------|
| 1 | Path-variable substitution (`${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_SESSION_ID}`, etc.) | `contract.md` Problem Statement; `spec.md` rewriter "applies mappings (path vars …)"; `SKILL.md` Step 8. | Workflow step 8 ("Path variables: inline string replacement per mapping"). Dedicated **Install layout > Path-variable substitution** section. Computed defaults provided when a mapping does not specify a literal: `${CLAUDE_PLUGIN_ROOT}` → `{install_location}/.config/{plugin-name}/`; `${CLAUDE_SKILL_DIR}` → `{install_location}/skills/{skill-name}/`; `${CLAUDE_SESSION_ID}` → target harness's session-id env var or a literal env-var reference. Substitution table recorded once in `silent_assumptions` with `category: path-variables-resolved`. Inline replacement only — no injected "Path Variables" prose block. | `mappings` entries for the path-variable findings, with built-in computed defaults as fallback. |
| 2 | Tool-name rewrites (e.g. `AskUserQuestion`, `WebFetch`, `Read`, `Edit`) | `contract.md` Problem Statement; `spec.md` rewriter. | Workflow step 8 ("Tool names: in YAML `tools:`/`allowed-tools:` fields, replace per mapping; in prose, replace capitalized occurrences"). | `mappings` only. The instruction text limits prose replacements to **capitalized** occurrences, which is a deliberate guardrail to avoid stomping common English words. |
| 3 | Model-alias rewrites (`opus`, `sonnet`, `haiku`) | `contract.md` Problem Statement; `spec.md` rewriter. | Workflow step 8 ("Model aliases: replace `model:` frontmatter values and prose mentions"). | `mappings`. |
| 4 | Frontmatter rewrites (agent / command / skill) | `spec.md` rewriter Key behaviors ("frontmatter rewrites"); `contract.md` Problem Statement. | Workflow step 8 ("Agent/command/skill frontmatter: rewrite using the structured field mapping; drop fields mapped to `null`"). | Researcher-supplied structured `target_construct` objects per `port-plan-schema.md` § mappings entry. |
| 5 | Hooks (`hooks/hooks.json` event names + script paths) | `contract.md` Goals; `spec.md` rewriter. | Workflow step 8 ("Hooks: translate `hooks.json` event names per mapping; adjust script paths"). Top-level `hooks/` copied as-is to `{install_location}/hooks/` if not relocated; dropped with `silent_assumptions: no-target-equivalent` when the target has no hooks concept. | `mappings`. |
| 6 | `plugin.json` metadata | `contract.md` Problem Statement; `spec.md` rewriter. | Workflow step 8 ("`plugin.json`: emit target manifest equivalent if one exists"). When no equivalent exists, this implicitly falls under the marketplace-drop pattern (#11 below). | `mappings`. |
| 7 | Slash commands (`commands/*.md`) | `contract.md` In Scope. | Top-level `commands/` copied as-is to `{install_location}/commands/` after per-file content transforms (#1–#3, #10) when not relocated by mapping. Dropped with `silent_assumptions: no-target-equivalent` if the target has no commands concept. | Install-layout rules + per-file content transforms. |
| 8 | Shared / config directories | `contract.md` In Scope; `spec.md`. | Workflow step 8 ("Shared dir: relocate per mapping (default destination: `{install_location}/.config/{plugin-name}/`)"). The install-layout `.config/{plugin-name}/` bucket also catches "everything else from the plugin root that isn't on the skip list". | `mappings`, with install-layout defaults. |
| 9 | Local-config translation (env-var names, paths) | `spec.md` rewriter. | Workflow step 8 ("Local config: translate env-var names and paths"). | `mappings`. |
| 10 | Prose Claude references (e.g. "Claude Code") | Implied by `contract.md` Problem Statement; explicit in rewriter step 8. | Workflow step 8 ("Prose Claude references: replace per mapping (target harness name or neutral term)"). | `mappings`. |
| 11 | Marketplace metadata | `spec.md` rewriter Key behaviors implied by "plugin.json metadata"; `contract.md` Out of Scope explicitly excludes publishing. | Workflow step 8 ("Marketplace metadata: usually drop"). | Rewriter heuristic — "usually drop" leaves room for `mappings` to override but defaults to silent drop. |
| 12 | MCP server declarations | `references/harness-concepts.md` taxonomy category 13; rewriter dedicated section. | Dedicated **Install layout > MCP server declarations** section. Merged into target's project-scope config (e.g. `opencode.json`, `.cursor/mcp.json`) per the researcher's mapping `target_config_path`. Five-rule merge protocol (create-if-absent, preserve other top-level keys, do-not-overwrite-on-name-conflict, transport-key translation, log to `files_written`). Conflicts produce a `silent_assumptions: mcp-conflict` entry. | `mappings` (including `target_config_path`). |

### Mappings as source of truth

The instruction file consistently phrases each transformation as "per
mapping" or "per the mapping". Built-in harness-specific knowledge is
limited to:

- The install-layout skeleton (skills/, commands/, hooks/, references/,
  `.config/{plugin-name}/`) and the "MUST NOT be written" skip list.
- Computed defaults for path-variable substitution when a mapping does
  not specify a literal.
- Heuristic destinations for MCP project-config files when
  `target_config_path` is unset (OpenCode and Cursor are named
  explicitly; "Generic" defers to the researcher's mapping).
- The "usually drop" default for marketplace metadata.

Every other transformation is data-driven from `mappings`. The
rewriter's contract violation surface is therefore narrow: it cannot
invent a target construct that the researcher did not supply.

## Backup behavior

`docs/contract.md` Success Criteria require: "Final files land at the
user-chosen install destination; existing files are backed up before
overwrite."

The rewriter satisfies this in workflow step 9:

> Before writing each destination file, check if it exists. If it does,
> move it to `{install_location}/.plugin-porter-backup/{timestamp}/{relative-path}`
> and append a `files_backed_up` entry. Set `rewrite_log.backup_root`
> if not already set.

Specifics:

- One `backup_root` per run, established on the first backup and reused.
- Backups are **moves**, not copies, before the new file is written.
- Each backup is recorded as a `files_backed_up` entry: `source` is the
  install-relative path, `backup` is the absolute path under the
  timestamped backup root.
- A failure to back up (e.g. permission error on the existing file) is
  a blocker — the rewriter appends to `blockers`, leaves partial work
  in place, and terminates.
- "Forbidden" rules explicitly prohibit overwriting a destination file
  without backing it up first.

## Idempotency

`SKILL.md` § Idempotency states: "The rewriter is idempotent: it
consults `rewrite_log.files_written` and skips files already
processed."

The rewriter implements this in workflow steps 5 and 8 / § Idempotency:

- Step 5: Read existing `rewrite_log.files_written`; on a resumed run
  it may be non-empty.
- Step 8 (per file): determine the destination per install layout +
  mappings.
- After each file is written, append it to `rewrite_log.files_written`
  via Edit on `port-plan.md` (step 11).
- § Idempotency: "Skip any source file whose destination is already
  listed. Continue with the rest."

The append-after-write order means a crash between write and log-edit
can leave a written file unrecorded; on resume, the rewriter would
re-process it. Because step 9 backs up any existing destination file
before overwriting, the second pass moves the just-written file to the
backup root and writes a fresh copy — no data loss, but `backup_root`
will then contain rewriter-produced artifacts. This is benign but
worth noting for forensic audits.

The MCP merge step is also idempotent by construction: rule 3 in the
merge protocol does not overwrite an existing server entry of the same
name and instead emits a `silent_assumptions: mcp-conflict` entry.

## Missing-mappings handling

`docs/contract.md` requires that "every `finding_id` in `findings` must
have exactly one `mappings` entry." The rewriter enforces this
defensively in workflow step 4:

> Verify every `finding_id` in `findings` has a `mappings` entry. If
> any are missing, append `blockers` with
> `reason: "missing mappings for: F003, F007, …"` and terminate.

The "When to write a blockers entry" section also enumerates this as
the first triggering condition. Per `SKILL.md` § Error Handling, this
indicates a researcher bug, not a user-fixable issue, so the parent
halts and reports.

Other rewriter-side blocker triggers:

- `meta.install_location` is unwriteable (permission error or
  non-creatable parent).
- A pre-existing destination file cannot be backed up.

In every case the rewriter appends to `blockers`, leaves partial work
in place, and terminates with `blocked: <one-line reason>`.

## TODO-marker behavior

When a `mappings` entry's action is `leave-raw-with-todo` (one of the
four canonical missing-concept dispositions per `contract.md` Success
Criteria — "skip, approximate, leave raw, or insert a TODO marker"),
the rewriter inserts a structured comment at the top of the emitted
file (workflow step 10):

```
<!-- TODO(plugin-porter): {category} — {reason}. Original construct: {raw_snippet}. Please resolve manually. -->
```

It also appends an entry to `rewrite_log.todos_inserted` with `file`,
`finding_id`, and `reason` per the schema. The parent surfaces the
list of TODO-marked files in the final summary (`SKILL.md` Step 9) so
the user can resolve them manually.

## File-emission rules and skip lists

Two complementary mechanisms govern what the rewriter emits:

- **Install-layout HARD RULES** — files outside `skills/`, `commands/`,
  `hooks/`, `references/`, or `.config/{plugin-name}/` are bugs, with
  one sanctioned exception: the target's project MCP config file.
- **MUST NOT be written** silent-skip list — `README*`, `LICENSE*`,
  `SECURITY.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `.github/`, `.gitignore`, `.gitattributes`, `.editorconfig`,
  top-level `docs/`, repo build/release scripts, `node_modules/`,
  `dist/`, `.git/`, `*.lock`. Each skipped path is recorded once in
  `silent_assumptions` with `category: plugin-repo-metadata-skipped`.
- **Source enumeration exclusions** — Glob excludes `node_modules/`,
  `dist/`, `.git/`, `*.lock`, and binaries before any per-file logic.

A mapping resolving to `skip` for a file's category causes silent
omission; a mapping resolving to `null` for a frontmatter field causes
that field to be dropped during the rewrite.

## Termination protocol

The rewriter's terminal message is constrained to one of:

- `files_written: N, files_backed_up: M, todos_inserted: K` on success.
- `blocked: <one-line reason>` on failure (with the corresponding
  `blockers` entry already written to `port-plan.md`).

Per `SKILL.md` Step 8, the parent reads this line and transitions
`status: rewriting → complete` on success, or `status: → blocked` on
failure.

## Gaps and uncertainties

The following items are stated implicitly or are not fully specified
in the rewriter instruction file. They are documented here as
known-unknowns, not as defects.

1. **Tool-name prose replacement scope.** Step 8 limits prose tool-name
   replacement to "capitalized occurrences." The instruction does not
   define whether this means strict word-boundary capitalization
   (`\bAskUserQuestion\b`), backtick-fenced occurrences, or any
   capitalized substring. Implementations may diverge.

2. **Per-file content transforms applied to top-level `commands/`,
   `hooks/`, `references/`.** The install-layout section says these
   are copied "as-is … (after applying the per-file content transforms
   in step 8)". The exact subset of step-8 transforms to apply to a
   non-skill file (e.g. a hook script vs. a reference markdown) is
   not enumerated. Path vars and tool-name rewrites are presumably
   universal; frontmatter rewrites are file-shape-dependent.

3. **`leave-raw-with-todo` mapping shape.** The TODO-marker block
   templates `{category}`, `{reason}`, and `{raw_snippet}`. The
   schema in `port-plan-schema.md` § mappings entry does not
   formally name an `action` field; the action is implied by the
   `target_construct` shape and `notes`. The rewriter relies on the
   researcher to surface a recognizable signal (likely
   `target_construct: leave-raw-with-todo` or similar). Any contract
   between researcher and rewriter on the exact action keyword lives
   in `decision-taxonomy.md`, not in the rewriter file itself.

4. **`plugin.json` → target-manifest emission.** Step 8 says "emit
   target manifest equivalent if one exists" but does not specify the
   destination path or naming convention. This is delegated entirely
   to the researcher's mapping. When no target manifest exists, the
   behavior implicitly devolves into the marketplace-drop pattern,
   but no explicit `silent_assumptions` entry is mandated for the
   drop.

5. **Crash-recovery between write and log-edit.** As noted under
   Idempotency, a crash after writing a file but before appending to
   `rewrite_log.files_written` results in the file being moved to the
   backup root on the next run. This is correct from a data-safety
   standpoint but means `backup_root` is not exclusively populated by
   pre-existing user files.

6. **MCP `target_config_path` heuristics.** The rewriter names
   OpenCode and Cursor explicitly and otherwise defers to the
   researcher's mapping. A target harness whose MCP convention is not
   in the researcher's mapping AND not OpenCode/Cursor will surface
   as a researcher-side gap (missing `target_config_path`), not a
   rewriter blocker. The rewriter's behavior in that case is
   undefined by the instruction file.

7. **File-mode preservation.** The instruction file's "silent
   assumptions" example mentions "preserved file mode 0755 on shell
   scripts" but does not state file-mode preservation as a hard rule.
   Implementations should preserve executable bits on hook scripts
   and other executables, and record the assumption.

## Cross-references

- `docs/spec.md` § Per-Component Details > `references/agents/rewriter.md`.
- `docs/contract.md` § Success Criteria, § Design Decisions.
- `SKILL.md` Step 8 (Rewrite), § Idempotency and resumability,
  § Error Handling.
- `references/port-plan-schema.md` § rewrite_log, § mappings entry,
  § Section ownership.
- `references/agents/rewriter.md` (primary).
