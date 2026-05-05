# Taxonomy Alignment: Harness Concepts ↔ Decision Taxonomy

## Purpose

The plugin-porter skill operates on three pillars: **exploration** (the
scanner enumerates source-plugin constructs), **research** (the
researcher maps each construct to a target-harness equivalent), and
**user input** (the parent surfaces unresolvable questions via
`AskUserQuestion`). The bridge between research findings and user
input is `references/decision-taxonomy.md`: it tells the researcher,
for any given finding, whether to apply a silent default, apply a
default but confirm on weak signal, or always escalate.

Alignment between `references/harness-concepts.md` (the source-side
taxonomy of constructs the scanner emits) and
`references/decision-taxonomy.md` (the policy taxonomy the researcher
consults) is therefore load-bearing. Misalignment shows up as one of
two failure modes:

- **Over-prompting**: a concept has no documented silent default, so
  the researcher escalates everything to `open_questions` and the
  user is asked things that have a defensible single answer.
- **Silent-but-wrong**: a concept has no policy entry at all, so the
  researcher invents a default that bypasses both the silent-default
  audit trail (`silent_assumptions`) and the user-input gate.

This document is the cross-reference between the two files. Update it
whenever either reference file changes.

## Alignment Matrix

Each row is a category from `harness-concepts.md`. The Policy column
records which decision-taxonomy bucket the construct falls into. The
Evidence column quotes (or paraphrases) the specific taxonomy entry
that covers it.

| # | Harness Concept | Policy | Decision-Taxonomy Evidence |
| - | --------------- | ------ | -------------------------- |
| 1 | Path Variables (`${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_SESSION_ID}`, `$ARGUMENTS`) | Silent-default | "Path-variable string replacement" — inline substitution to absolute resolved paths under the install location; substitution table recorded once in `silent_assumptions`. |
| 2 | Built-in Tool Names (`Read`, `Write`, `Bash`, `AskUserQuestion`, …) | Silent-default | "Tool-name renames: mechanical lookup of target-equivalent names from the researcher's tool inventory." |
| 3 | Model Aliases (`opus`, `sonnet`, `haiku`, versioned variants) | Silent-default *with ask-rarely fallback* | "Frontmatter mechanical translations: … model-alias preservation when the target accepts the same alias, dropping fields the target does not support." Categories Summary Table row 3 in `harness-concepts.md` adds: "asking if multiple variants exist" — i.e. ambiguous variant selection escalates under "Structurally ambiguous mappings" (always-ask). |
| 4 | Agent Frontmatter Schema | Silent-default | "Frontmatter mechanical translations: field renames, tool-list shape conversion (string vs list vs object-of-booleans) … dropping fields the target does not support." |
| 5 | Slash Command Frontmatter Schema | Silent-default *with always-ask fallback* | Same "Frontmatter mechanical translations" entry covers field-by-field translation. When the target has no command concept, the loss falls under "Lossy semantic translations … invocation gates dropped without a config-level replacement." |
| 6 | Skill Frontmatter Schema | Silent-default *with always-ask fallback* | Same as #5. Same fallback applies if the target has no skill concept. |
| 7 | Hooks (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`, …) | Silent-default *for permission gates*; Always-ask for general lossy translations | "Permission / pre-tool hooks → declarative permission rules": translate to recommend-only config snippet. General hook events with no target equivalent fall under "Lossy semantic translations … permission or invocation gates dropped without a config-level replacement." |
| 8 | `plugin.json` Metadata | Silent-default | "Plugin manifest pass-through: keep the source plugin manifest verbatim alongside the ported output for reversibility, even if the target ignores it." |
| 9 | Shared Directory & Plugin-Scoped References | Silent-default | "Path-variable string replacement" entry: "shared assets at `{install}/.config/{plugin-name}/`." Combined with "Install path within the chosen scope: use the target's per-scope convention." |
| 10 | Local Config Pattern (`config.local.md`, `$XDG_CONFIG_HOME/{plugin}/`) | Silent-default | "Install path within the chosen scope: use the target's per-scope convention (XDG-style or equivalent) as documented by the researcher." |
| 11 | Marketplace Metadata (`.claude-plugin/marketplace.json`) | Silent-default | "Marketplace / registry metadata: drop if the target has no registry equivalent. Emit a recommended config snippet … do not auto-edit the user's config." |
| 12 | Prose References to Claude | Silent-default | "Prose brand rewrites: replace source-harness brand references with the target harness name, or with a neutral phrase … when the target is unspecified." |
| 13 | MCP Server Declarations | Silent-default (special exception) | "MCP server declarations → target project config": MERGE into target project-scope config; this is the **explicit exception** to "never auto-edit user config" because MCP declarations are part of the plugin contract. Conflicts on duplicate server names are recorded in `silent_assumptions`, not escalated. |

## Cross-Cutting Silent-Default Entries

Some decision-taxonomy entries do not map to a single
`harness-concepts.md` category but apply to *any* finding the scanner
emits. These are infrastructure-level policies the researcher applies
across all categories:

| Decision-Taxonomy Entry | Scope |
| ----------------------- | ----- |
| Backup-before-overwrite | Applies to every file the rewriter touches. Always on; never prompt. |
| Foreign-harness artifacts | Applies when the scanner emits a finding scoped to a third harness (neither source nor target). Skipped silently; recorded in `silent_assumptions`. Cross-cuts categories 4–7 (any framework artifact may be foreign-scoped). |
| Bootstrap / setup scripts (`setup.sh`) | Cross-cuts category 10 (local config) and bootstrap files generally. Port to a parallel `setup-{target}.sh`; preserve the original. |
| Project-root-only artifacts (`AGENTS.md`, `.mcp.json`, `.envrc`) when install scope is user-global | Cross-cuts category 13 (MCP) and any prose artifact intended for a project root. Skip and emit recommend-only snippet. |
| Plugin-repo metadata files (`README.md`, `LICENSE`, `.github/`, …) | Applies to any source-repo-only file. Never copied to install location; recorded in `silent_assumptions`. |

## Ask-Rarely Entries

| Entry | Trigger to ask |
| ----- | -------------- |
| Install scope (default: user-global) | Source references project-relative paths that don't resolve without a project context. |
| Documentation hints (default: empty) | Prior researcher pass failed to find target docs. |
| Resumability (default: reuse prior reports for same source + target) | Reports predate a change the user likely wants re-scanned. |

These are not tied to specific harness-concept categories — they are
run-level decisions that apply once per port, before the
findings-to-mappings translation begins.

## Always-Ask Entries

| Entry | Why no default |
| ----- | -------------- |
| Target harness | Free-text input; required to even begin research. |
| Structurally ambiguous mappings | Source encodes the same capability in two or more forms (e.g. command + skill entry points for the same feature) and the target supports multiple forms. |
| Lossy semantic translations | Multiple defensible resolutions: dependency graphs collapsing to flat todo lists; parallel-spawn constructs without a target equivalent; permission/invocation gates with no config-level replacement. |
| Auto-editing user config | Recommend-only by default; ask before editing existing user config files. **Exception**: MCP server declarations from the source plugin (category 13) — see silent-default. |

## Orphans

Decision-taxonomy entries that do not correspond to a specific
`harness-concepts.md` category (i.e. they describe rewriter or
parent-skill behaviors rather than constructs found by the scanner):

- **Backup-before-overwrite** — rewriter behavior.
- **Install path within the chosen scope** — rewriter behavior;
  applied to every category that produces an installable file.
- **Install scope** (ask-rarely) — parent-skill decision before
  scanning begins.
- **Documentation hints** (ask-rarely) — parent-skill decision before
  research begins.
- **Resumability** (ask-rarely) — parent-skill decision before
  re-running.
- **Target harness** (always-ask) — parent-skill decision; precondition
  to research.
- **Auto-editing user config** (always-ask) — rewriter-phase behavior;
  not a finding type.
- **Plugin-repo metadata files** silent-default — applies to any file
  the scanner sees in the source tree but not under a category-1-to-13
  prefix.

These orphans are correct by design: they describe *how* the porter
operates, not *what* it ports. They should remain in
`decision-taxonomy.md` and stay un-anchored to `harness-concepts.md`
categories.

## Gaps

Areas where alignment is incomplete or the policy is implicit rather
than explicit. Each gap is a candidate for a new entry in
`decision-taxonomy.md` or a clarification in `harness-concepts.md`.

### Gap 1: Model alias variant selection has no explicit policy

**Concept**: category 3 (Model Aliases). The Categories Summary Table
in `harness-concepts.md` says "Map to target's model naming, asking if
multiple variants exist." `decision-taxonomy.md` covers
"model-alias preservation when the target accepts the same alias" as
a silent default but does not name "multiple-variant ambiguity" as a
trigger. The phrase falls into the always-ask bucket only by analogy
to "Structurally ambiguous mappings."

**Recommendation**: add an explicit always-ask entry: "Model alias
disambiguation: when the target advertises multiple models that all
plausibly match the source alias (e.g. several Sonnet generations),
ask which to use. Default applies only when exactly one match
exists."

### Gap 2: Hook events with no target equivalent

**Concept**: category 7 (Hooks). The taxonomy explicitly handles
*permission* hooks (`PreToolUse` Bash gates → declarative permission
rules). It does not name a policy for the other event types
(`PostToolUse`, `UserPromptSubmit`, `Notification`, `SessionStart`,
`SessionEnd`, `Stop`, `SubagentStop`, `PreCompact`, `SessionResume`).
They fall into "Lossy semantic translations" only by inference.

**Recommendation**: add a silent-default entry: "Non-permission hook
events: when the target has a corresponding lifecycle event, map
mechanically and record in `silent_assumptions`. When it does not,
emit a recommend-only stub in the rewrite summary and record the loss
— do not escalate per-event unless the user has flagged hook fidelity
as critical." This converts an ambiguous always-ask to an explicit
silent-default with a recommend-only escape, matching the pattern
used for permission hooks and marketplace metadata.

### Gap 3: Slash command and skill loss when target has neither concept

**Concepts**: categories 5 and 6. The Categories Summary Table says
"or flag if no command concept" / "or flag if no skill concept."
"Flag" is not a defined taxonomy bucket. By inference this is
"Lossy semantic translations" (always-ask), but the alignment is
implicit.

**Recommendation**: clarify in `decision-taxonomy.md` that "flag"
maps to always-ask via "Lossy semantic translations." Alternatively,
add a silent-default for the case where the target has a generic
agent/instruction concept that can host the construct as prose
(e.g. an OpenCode `AGENTS.md` rule): collapse to that with a
recommend-only note.

### Gap 4: `$ARGUMENTS` and positional args have no target-equivalent rule

**Concept**: category 1 (Path Variables, sub-bullet for command
arguments). The silent-default entry covers `${CLAUDE_PLUGIN_ROOT}`
and `${CLAUDE_SKILL_DIR}` by name but does not name `$ARGUMENTS` or
`$0..$N`. These are command-invocation runtime variables, not
filesystem paths, and the substitution rule "absolute resolved paths
under the install location" does not apply to them.

**Recommendation**: split category 1 in `harness-concepts.md` into
"filesystem path variables" and "command argument variables," or add
a silent-default entry in `decision-taxonomy.md` for the latter:
"Command argument variables: preserve as-is when the target uses the
same syntax; rewrite to the target's argument syntax (e.g. `{{args}}`
in some harnesses) per the researcher's mapping. If the target has
no slash-command concept, the variables are dropped along with the
command itself under category-5 lossy-translation policy."

### Gap 5: Categories Summary Table conflict on Marketplace metadata

**Concept**: category 11. The Summary Table row says "Drop or
translate to target's registry format." `decision-taxonomy.md` is
firmer: "drop if the target has no registry equivalent. Emit a
recommended config snippet … do not auto-edit the user's config."
The Summary Table's "translate" branch has no taxonomy entry — it is
ambiguous whether translating to a foreign registry is a silent
default or an always-ask.

**Recommendation**: either remove "translate" from the Summary Table
(matching the conservative recommend-only stance in the taxonomy) or
add a silent-default entry: "If the target has a registry equivalent
and the translation is mechanical (name, version, description), emit
the translated entry as a recommend-only snippet, never auto-merging
into the user's registry."

## Are Silent-Default Policies Safe Without User Input?

Audit of each silent-default entry against the question "does this
imply an implicit user-input gate?":

| Silent-Default | Safe to apply without asking? | Notes |
| -------------- | ----------------------------- | ----- |
| Tool-name renames | Yes | Mechanical lookup; recorded in `silent_assumptions`. |
| Prose brand rewrites | Yes | Reversible string substitution. |
| Frontmatter mechanical translations | Yes, with caveat | Field drops are recorded; if the dropped field carried semantic weight, the loss surfaces in the audit trail rather than the moment of rewrite. Acceptable per contract. |
| Plugin manifest pass-through | Yes | Adds rather than removes information. |
| Backup-before-overwrite | Yes | Only adds files; never destroys. |
| Install path within the chosen scope | Yes | Depends on `install_scope` being resolved (ask-rarely default applies). |
| Marketplace / registry metadata | Yes | Recommend-only output; user pastes manually. |
| Foreign-harness artifacts | Yes | Skip is reversible; recorded for audit. |
| Bootstrap / setup scripts | Yes | Source preserved; new script is additive. |
| Project-root-only artifacts when scope is user-global | Yes | Recommend-only snippet; user manually places. |
| Permission / pre-tool hooks → declarative rules | Yes | Recommend-only snippet; user manually applies. |
| MCP server declarations → target project config | **Conditionally yes** | This is the explicit exception to "never auto-edit user config." Safe because (1) MCP declarations are part of the plugin contract, not user preference; (2) duplicate-name conflicts preserve the existing entry; (3) the edit is scoped to project config under the install location, not a global user file. **Implicit gate**: relies on `install_location` being resolved correctly upstream. |
| Plugin-repo metadata files | Yes | Skip-only; never destructive. |
| Path-variable string replacement | Yes | Substitution table recorded; relies on the rewriter's layout being deterministic. |

**Conclusion**: every silent-default policy is safe to apply without
user input *given that the upstream ask-rarely decisions
(`install_scope`, `target_harness`) have been resolved*. The MCP
server exception is the only silent default that touches a user-owned
file, and its safety rests on the install-location scoping rule. No
silent default should be reclassified as ask-rarely or always-ask
based on this audit.

## Cross-Reference: Spec Phase 4 Taxonomy Additions

`docs/spec.md` Phase 4 names four taxonomy additions:

| Spec-named addition | Status in current `decision-taxonomy.md` |
| ------------------- | ---------------------------------------- |
| Foreign-harness artifact silent default | Present. "Foreign-harness artifacts in the source: … skip them. Record in `silent_assumptions`." |
| `setup.sh` port pattern | Present. "Bootstrap / setup scripts: … port it to a parallel `setup-{target}.sh`." |
| `AGENTS.md` install-location awareness | Present (generalized). "Project-root-only artifacts when install scope is user-global … skipped when `install_location` is a user-global path." `AGENTS.md` is one of the named examples. |
| `PreToolUse` Bash hook → permission rules pattern | Present. "Permission / pre-tool hooks → declarative permission rules." |

All four Phase 4 additions are landed. This taxonomy-alignment
document should be revisited if any of the gaps above (Gaps 1–5) are
resolved by adding new entries in a future phase.

## Uncertainty Notes

- The mapping of category 3 (Model Aliases) to **silent-default with
  always-ask fallback** is partially inferred. The Categories Summary
  Table in `harness-concepts.md` and the Frontmatter entry in
  `decision-taxonomy.md` agree on the silent path; the always-ask
  fallback for ambiguous variants is implied but not named. Gap 1
  formalizes this.
- The mapping of categories 5 and 6 (Command/Skill frontmatter) to a
  fallback policy is implied via "Lossy semantic translations" but is
  not stated explicitly. Gap 3 formalizes this.
- The Summary Table in `harness-concepts.md` uses "flag" and
  "translate" as informal verbs that have no defined home in
  `decision-taxonomy.md`. These are likely to drift if either file is
  edited in isolation; the gaps section names each instance.
- This document does not check `references/agents/researcher.md` or
  `references/port-plan-schema.md` for whether the researcher
  actually applies the policies as written. That is an enforcement
  question, separate from the alignment question handled here.
