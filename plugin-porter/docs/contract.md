# plugin-porter — Contract

## Problem Statement

Plugin authors on Claude Code build rich bundles — skills, agents, slash commands, hooks, shared references — that encode their workflow. When that same author (or a collaborator) moves to a different agent harness (Cursor, OpenCode, Agent Zero, Codex CLI, etc.), the plugin is stranded. Claude-specific conventions are scattered throughout: `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_SKILL_DIR}` path variables, tool names like `AskUserQuestion` and `WebFetch`, model aliases (`opus`, `sonnet`, `haiku`), `plugin.json` metadata, frontmatter schemas for agents and commands, and `hooks/hooks.json` shapes. Rewriting a plugin by hand for a new harness is tedious, error-prone, and requires the author to rediscover target-harness conventions every time. The cost is that plugin work doesn't travel — each harness migration is effectively a rewrite.

## Goals

1. Accept a Claude-style plugin folder (local path or git URL) and produce a working installation in a user-chosen target harness with minimal manual cleanup.
2. Make the porting process debuggable and resumable by persisting all state to a single shared planning document.
3. Surface ambiguity (e.g. "target harness has two haiku-class models, which one?") through structured document fields that the parent skill reads and presents — never directly from a subagent to the user.
4. Stay harness-agnostic: the skill researches the target harness dynamically rather than hardcoding support for a fixed list.

## Success Criteria

- [ ] Given a path to a Claude plugin, the skill produces a `port-plan.md` whose `findings` section enumerates every Claude-specific construct (env vars, tool names, model names, frontmatter fields, slash commands, hooks, plugin.json metadata, shared/config files).
- [ ] Given a target harness name, the same `port-plan.md` accumulates `mappings`, `silent_assumptions`, `open_questions`, and `blockers` sections through subagent contributions.
- [ ] All user-facing prompts originate from the parent skill, surfaced from `open_questions` or `blockers` entries written into `port-plan.md`. Subagents physically lack the tooling to prompt and have no decision branches that would make prompting attractive.
- [ ] The rewriter produces ported files that reference the target harness's path variables, tool names, model names, and agent definition conventions.
- [ ] Final files land at the user-chosen install destination; existing files are backed up before overwrite.
- [ ] `port-plan.md` persists to `./docs/plugin-porter/{plugin-name}/` so a failed run can be inspected and a subsequent run can resume by reading current `status` and continuing.
- [ ] When the target harness has no equivalent for a Claude concept (e.g. no hooks), the user is asked per case via an `open_questions` entry whether to skip, approximate, leave raw, or insert a TODO marker.

## Scope Boundaries

### In Scope

- Source: local path to a Claude plugin folder OR a git URL (cloned to a tmp dir; remote never modified).
- Portable items: skills (SKILL.md + references/), agents (agents/*.md), slash commands (commands/*.md), hooks (hooks/hooks.json + hook scripts), plugin.json metadata, shared/ content, and config.local.md templates.
- Three subagents with distinct, narrow responsibilities, all coordinating through one shared `port-plan.md` document. No subagent talks to the user; no subagent returns structured data via its terminal message; their only side effect is mutating their assigned section of `port-plan.md`.
- Interactive clarification of ambiguity surfaced by the parent reading `open_questions` from the plan document.
- Writing final output directly to the user-chosen install location, with backups of any conflicting files.

### Out of Scope

- Porting *to* Claude from another harness. This skill is one-directional (Claude → other).
- Publishing or committing the ported plugin to the target harness's marketplace/registry.
- Modifying the source plugin in place. The source is read-only.
- Executing the ported plugin to verify it works end-to-end. Validation is structural, not behavioral.
- Hardcoding per-harness knowledge bases. The researcher discovers conventions on demand.

### Future Considerations

- A learnings.md that accumulates per-harness quirks so repeat ports of the same target harness skip re-research.
- Reverse direction (non-Claude → Claude) as a sibling skill.
- Batch mode: port a whole marketplace at once.

## Design Decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| Coordination model | Document-driven: one shared `port-plan.md` is the only state. Subagents read assigned sections and write assigned sections. No RPC, no return values, no terminal-message protocols. | Eliminates the failure mode where subagents face an unresolved decision and fall back to interactive prompts. Subagents have no decisions to communicate beyond mutating the document. |
| User-interaction boundary | Only the parent skill calls `AskUserQuestion`. Subagents lack the tool and lack any termination path that would benefit from prompting. When stuck, a subagent appends to `blockers` in the document and terminates. | Removes the recurring bug where subagents prompt the user (or the harness's question fallback) instead of structured-recording their need. |
| Installation scope | Project skill at `.claude/skills/plugin-porter/` | User preference; no plugin.json needed; agent definitions live as reference markdown that subagents load at spawn time. |
| Subagent count | 3 separate agents (scanner, researcher, rewriter) | Clear separation of concerns; each agent owns one section of `port-plan.md`; each is auditable independently. |
| Subagent instruction delivery | Markdown files in `references/agents/` loaded into the Task prompt | Works in project-skill mode where named plugin-level agents aren't available; harness-agnostic since any Task-capable harness can use this pattern. |
| State persistence | Single `port-plan.md` at `./docs/plugin-porter/{plugin-name}/port-plan.md` in current working dir, with a top-level `status` field driving the state machine | Debuggable, resumable, visible to the user; one file replaces three previous reports; resumability becomes "read status, dispatch next role." |
| Source input | Local path OR git URL | Git URLs clone to tmp and never modify the remote; broadens usefulness without coupling to local checkouts. |
| Target harness | Discovered interactively, not hardcoded | Keeps the skill harness-agnostic on day one; research cost is paid per-run but reports can be cached under learnings.md later. |
| Missing concepts | Surfaced as `open_questions` entries (skip / approximate / leave raw / TODO marker) | Preserves author intent; refuses to silently drop features. |
| Output location | Direct write to user-confirmed install path, backing up conflicts | Matches user preference; staged dirs add friction for the common case. |
| Model assignments | All three subagents: sonnet | Each agent has moderate complexity and benefits from reasoning + tool use, but opus is overkill. |
