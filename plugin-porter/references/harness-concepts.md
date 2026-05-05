# Harness Concepts — Taxonomy

This is the shared taxonomy of Claude-specific plugin constructs that plugin-porter's scanner and researcher both use. The taxonomy enumerates **thirteen** categories (1–13 below). Every Claude construct the scanner finds falls into exactly one of these categories, and the researcher must produce a mapping (or escalate via "Lossy semantic translations" in `decision-taxonomy.md`) for each category present in the scan.

## 1. Path Variables

Variables injected at runtime by Claude Code into skill and agent prompts.

| Variable | Meaning |
| -------- | ------- |
| `${CLAUDE_PLUGIN_ROOT}` | Absolute path to the plugin root directory |
| `${CLAUDE_SKILL_DIR}` | Absolute path to the current skill directory |
| `${CLAUDE_SESSION_ID}` | UUID of the current session |
| `$ARGUMENTS`, `$0`..`$N`, `$ARGUMENTS[N]` | Positional arguments passed to a slash command |

**Scan signal**: literal occurrences of the tokens above in any file.

## 2. Built-in Tool Names

Claude-branded tool names that appear in agent frontmatter `tools:` lists, skill `allowed-tools` lists, and inline prose.

Common: `Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `Task`, `WebFetch`, `AskUserQuestion`, `TodoWrite`, `NotebookEdit`, `SlashCommand`, `MultiEdit`, `Skill`.

**Scan signal**: tool names in YAML `tools:` or `allowed-tools:` fields, or capitalized tool-name references in prose (e.g. "Use the AskUserQuestion tool").

## 3. Model Aliases

Short Claude model names used in agent frontmatter `model:` fields and sometimes in prose.

Common: `opus`, `sonnet`, `haiku`, `claude-opus-4`, `claude-sonnet-4`, `claude-haiku-4` (and versioned variants).

**Scan signal**: values of `model:` frontmatter fields; model-name strings in prose.

## 4. Agent Frontmatter Schema

Claude agent definitions live at `agents/{name}.md` with YAML frontmatter including fields like `name`, `description`, `tools`, `model`, and prose instructions as the body.

**Scan signal**: files under `agents/` with YAML frontmatter. Record the full frontmatter for each so the researcher can map field-by-field to the target harness's agent schema.

## 5. Slash Command Frontmatter Schema

Commands live at `commands/{name}.md` with YAML frontmatter including fields like `description`, `argument-hint`, and prose as the body. Commands are invoked with `/{name}`.

**Scan signal**: files under `commands/` with YAML frontmatter.

## 6. Skill Frontmatter Schema

Skills live at `skills/{name}/SKILL.md` (in plugins) or `.claude/skills/{name}/SKILL.md` (project) with YAML frontmatter: `name`, `description`, `allowed-tools`, `disable-model-invocation`, `user-invocable`, `context`, `agent`, `model`, `argument-hint`, `hooks`, `metadata`.

**Scan signal**: SKILL.md files anywhere in the tree.

## 7. Hooks

Lifecycle hooks configured via `hooks/hooks.json`. Event names include `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Notification`, `SessionStart`, `SessionEnd`, `Stop`, `SubagentStop`, `PreCompact`, `SessionResume`.

**Scan signal**: `hooks/hooks.json` file plus any hook scripts it references.

## 8. plugin.json Metadata

Plugin manifest: `name`, `version`, `description`, `author`, `homepage`, `keywords`, and sometimes entries for skills/agents/commands/hooks.

**Scan signal**: `plugin.json` at the plugin root.

## 9. Shared Directory & Plugin-Scoped References

The `${CLAUDE_PLUGIN_ROOT}/shared/` convention and any other references using `${CLAUDE_PLUGIN_ROOT}` to point at shared assets across multiple skills.

**Scan signal**: presence of a `shared/` directory; references to `${CLAUDE_PLUGIN_ROOT}` pointing outside the current skill dir.

## 10. Local Config Pattern

Plugins sometimes ship a `config.local.md` template or a bootstrap script that writes to `$XDG_CONFIG_HOME/{plugin-name}/`. Paths and env-var names here are Claude-convention.

**Scan signal**: `config.local.md`, `.env` templates, or any bootstrap/scripts referring to `~/.config/{plugin-name}/`.

## 11. Marketplace Metadata

Entries in a parent marketplace.json, sync scripts, or README conventions that assume the plugin lives in a Claude marketplace.

**Scan signal**: references to `.claude-plugin/marketplace.json` inside the plugin tree; README badges or install instructions assuming Claude marketplace syntax.

## 12. Prose References to Claude

Documentation strings, SKILL.md prose, or comments that reference "Claude", "Claude Code", or Anthropic-specific behaviors (e.g. "Claude will automatically load this skill when...").

**Scan signal**: case-insensitive matches of `claude`, `anthropic`, or tool-branded verbs ("Claude auto-triggers").

## 13. MCP Server Declarations

Plugin-shipped Model Context Protocol server registrations. Sources: a top-level `.mcp.json`, an `mcpServers` block inside `plugin.json`, or a `mcp:` block inside SKILL.md frontmatter. These are part of the plugin's contract — without them, the plugin's tools/data fail to wire up — so they install into the target's project config rather than being recommend-only.

Common transport keys to translate: Claude `"type": "http"` → OpenCode `"type": "remote"`; Claude `"type": "stdio"` → OpenCode `"type": "local"`. Auth/headers/env passthroughs follow the target's schema.

**Scan signal**: `.mcp.json` at plugin root; `mcpServers` key in `plugin.json` or SKILL.md frontmatter; references to `mcp.` URLs.

---

## Categories Summary Table

| # | Category | Rewrite strategy |
| - | -------- | ---------------- |
| 1 | Path variables | String replacement with target equivalent |
| 2 | Tool names | Lookup per target harness's tool inventory |
| 3 | Model aliases | Map to target's model naming. Silent-default when exactly one target model matches; always-ask via `decision-taxonomy.md` "Model alias disambiguation" when multiple plausible variants exist |
| 4 | Agent frontmatter | Field-by-field schema translation |
| 5 | Command frontmatter | Field-by-field schema translation. When the target has no command concept, escalate via `decision-taxonomy.md` "Lossy semantic translations" (always-ask) |
| 6 | Skill frontmatter | Field-by-field schema translation. When the target has no skill concept, escalate via `decision-taxonomy.md` "Lossy semantic translations" (always-ask) |
| 7 | Hooks | Permission / pre-tool hooks → declarative rules (silent-default). Other hook events → mechanical map when target has equivalent, otherwise recommend-only stub (silent-default per `decision-taxonomy.md` "Non-permission hook events") |
| 8 | plugin.json | Emit target's manifest equivalent. When the target has no manifest concept, escalate via `decision-taxonomy.md` "Lossy semantic translations" (always-ask) |
| 9 | Shared dir | Relocate to target's shared-assets convention |
| 10 | Local config | Translate env-var and path conventions |
| 11 | Marketplace metadata | Drop if target has no registry equivalent. If target has a registry, emit a mechanical translation as a recommend-only snippet (silent-default); never auto-merge into the user's registry |
| 12 | Prose Claude references | Rewrite to neutral or target-harness references |
| 13 | MCP server declarations | Merge into target's project config (e.g. `opencode.json`); translate transport keys |
