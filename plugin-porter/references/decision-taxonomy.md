# Decision Taxonomy

Every decision point during a port falls into one of three categories. The researcher and the parent skill both consult this file before deciding whether to ask the user.

All categories below are expressed in harness-agnostic terms. Harness-specific knowledge lives in the researcher's WebFetch output and the researcher report — never inline in this taxonomy.

## Silent-default (never ask)

These decisions have a single defensible answer. Applying it without asking is the correct behavior; the defaulted choice is recorded in `silent_assumptions` so the user can audit it after the run.

- **Tool-name renames**: mechanical lookup of target-equivalent names from the researcher's tool inventory.
- **Prose brand rewrites**: replace source-harness brand references with the target harness name, or with a neutral phrase (e.g. "the agent", "the harness") when the target is unspecified in context.
- **Frontmatter mechanical translations**: field renames, tool-list shape conversion (string vs list vs object-of-booleans), model-alias preservation when the target accepts the same alias, dropping fields the target does not support.
- **Plugin manifest pass-through**: keep the source plugin manifest verbatim alongside the ported output for reversibility, even if the target ignores it.
- **Backup-before-overwrite**: always on. Never prompt.
- **Install path within the chosen scope**: use the target's per-scope convention (XDG-style or equivalent) as documented by the researcher.
- **Marketplace / registry metadata**: drop if the target has no registry equivalent. Emit a recommended config snippet the user can paste into their own config; do not auto-edit the user's config.
- **Foreign-harness artifacts in the source**: if the source plugin contains files explicitly scoped to a third harness that is neither source nor target (e.g. an `agents/openai.yaml` inside a Claude plugin being ported to OpenCode), skip them. Record in `silent_assumptions`.
- **Bootstrap / setup scripts**: if the source ships a `setup.sh` or equivalent that wires the plugin into the source harness, port it to a parallel `setup-{target}.sh` that performs the equivalent wiring for the target harness. The original is preserved in the source (read-only); the new script lives at the install location.
- **Project-root-only artifacts when install scope is user-global**: artifacts that only make sense at a project root (e.g. `AGENTS.md`, `.mcp.json`, `.envrc`) should be skipped when `install_location` is a user-global path. Emit a recommended snippet in the final summary so the user can place them manually if they want project-level wiring. Record in `silent_assumptions`.
- **Permission / pre-tool hooks → declarative permission rules**: when the source uses an executable pre-tool hook (e.g. a `PreToolUse` Bash gate) and the target has a declarative permission system, translate to a recommend-only config snippet rather than auto-editing the target's permission file. Record in `silent_assumptions`.
- **MCP server declarations → target project config**: when the source plugin declares MCP servers (e.g. `.mcp.json`, `mcpServers` block in `plugin.json`), MERGE them into the target's project-scope config file (e.g. `opencode.json`, `.cursor/mcp.json`, etc., per researcher's mapping). MCP server declarations are part of the plugin's contract, not user preference, so they install rather than recommend. Translate transport keys to the target's schema (e.g. Claude `"type": "http"` → OpenCode `"type": "remote"`). If the target config file does not exist, create it with only the `mcp` (or equivalent) block. If it exists and already declares a server with the same name, preserve the existing entry and record a conflict in `silent_assumptions`. This is the explicit exception to "never auto-edit user config" — project config under the install location is in scope.
- **Plugin-repo metadata files**: NEVER copy source-repo-only files into the install location. This includes `README.md`, `LICENSE`, `LICENSE.md`, `SECURITY.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `.github/`, `.gitignore`, top-level `docs/` describing the source repo (not skill-bundled references), and any build/release scripts under `scripts/` that operate on the source tree. These belong to the upstream repository, not the installed plugin. Record skipped paths in `silent_assumptions`.
- **Path-variable string replacement**: replace `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_SKILL_DIR}` (and equivalents) with the absolute resolved paths under the install location, computed from the rewriter's layout (skills at `{install}/skills/{name}/`, shared assets at `{install}/.config/{plugin-name}/`). Do not inject a separate "Path Variables" prose block — perform inline substitution following the mapping. Record the substitution table once in `silent_assumptions`.
- **Command argument variables**: `$ARGUMENTS`, `$0..$N`, `$ARGUMENTS[N]` and similar runtime placeholders inside slash-command bodies are NOT filesystem paths and are not handled by path-variable substitution. Preserve them as-is when the target uses identical syntax; otherwise rewrite to the target's argument syntax (e.g. `{{args}}`, `$1`, `${1}`) per the researcher's mapping. If the target has no slash-command concept, the variables are dropped along with the command itself under category-5 lossy-translation policy (always-ask).
- **Non-permission hook events** (`PostToolUse`, `UserPromptSubmit`, `Notification`, `SessionStart`, `SessionEnd`, `Stop`, `SubagentStop`, `PreCompact`, `SessionResume`): when the target has a corresponding lifecycle event, map mechanically (event-name rename, script-shape conversion) and record in `silent_assumptions`. When the target has no equivalent, emit a recommend-only stub in the rewrite summary and record the loss — do not escalate per-event unless the user has explicitly flagged hook fidelity as critical. Permission gates (`PreToolUse` Bash gates) are covered by the separate "Permission / pre-tool hooks" entry above.
- **Marketplace registry translation** (extends the "Marketplace / registry metadata" entry above): when the target DOES have a registry equivalent and the translation is mechanical (name, version, description, author), emit the translated entry as a recommend-only snippet in the final summary. NEVER auto-merge into the user's registry. The drop-vs-translate choice is a silent default; the recommend-only output mode is non-negotiable.

## Ask-rarely (defaults exist; confirm only when signal is weak)

Apply the default silently. Ask only when the signal the default depends on is missing or contradictory.

- **Install scope**: default to user-global. Only ask if the source references project-relative paths that don't resolve without a project context.
- **Documentation hints**: default to empty (let the researcher discover via WebFetch). Only ask if a prior researcher pass failed to find target docs.
- **Resumability**: default to reusing existing reports from a prior run for the same source + target. Only ask if the reports predate a change the user likely wants re-scanned.

## Always-ask (no defensible default)

Record these in `open_questions`. The parent surfaces each to the user via `AskUserQuestion`.

- **Target harness**: free-text; no default possible.
- **Model alias disambiguation**: when the target advertises multiple models that all plausibly match the source alias (e.g. several Sonnet generations, or both `gpt-4o` and `gpt-4o-mini` matching a generic "fast" tier), ask which to use. The silent default in "Frontmatter mechanical translations" applies only when exactly one target model matches the source alias unambiguously.
- **Structurally ambiguous mappings**: when the source encodes the same capability in two or more forms (e.g. both a command-style and a skill-style entry point for the same feature) and the target supports multiple forms, ask which form(s) to emit. **Note**: when `harness-concepts.md` Categories Summary Table uses the verb "flag" (rows 5, 6, 8) for a missing target concept, it maps to **this** entry or to "Lossy semantic translations" below — "flag" is not a separate policy bucket, it is shorthand for always-ask.
- **Lossy semantic translations**: dependency graphs collapsing to flat todo lists; parallel-spawn constructs without a target equivalent; permission or invocation gates dropped without a config-level replacement; slash commands dropped when the target has no command concept; skills dropped when the target has no skill concept; manifest dropped when the target has no manifest concept. When multiple resolutions are defensible, ask.
- **Auto-editing user config**: always recommend-only by default. Ask before performing any edit to an existing user config file (permission gates, plugin registration entries, shell rc files). Exception: MCP server declarations from the source plugin (see silent-default above) are merged into the target project's config without asking, because they are part of the plugin contract.

## Authoring new entries

When a port run surfaces a decision that this taxonomy doesn't cover, record it in `docs/learnings.md` for the run and propose a taxonomy entry in one of the three categories. Silent-default entries require a defensible single answer; ask-rarely entries require a clear default with a named trigger for asking; always-ask entries require evidence that multiple resolutions are defensible.
