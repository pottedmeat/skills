# plugin-porter — Learnings

Accumulated observations from plugin-porter runs. Appended after each successful port when the user surfaces a target-harness quirk worth recording. Entries should be short, dated, and focused on reusable insight (e.g. "Cursor expects `.cursor/rules/*.mdc` for agents, not `.cursor/agents/`").

Start empty. Grows over time.

---

## 2026-04-24 — opencode (first port; drove the parent-only-asks refactor)

- The researcher's direct `AskUserQuestion` calls made the parent unable to enumerate what was asked — user asked "what questions did you ask me?" and the parent could not answer for the researcher's prompts. Fixed by routing all user interaction through the parent via `open_questions` and stripping `AskUserQuestion` from the researcher's tool list.
- Source plugin had both a command and a skill for the same feature. Port silently emitted skill-only; should have been an always-ask decision. Added "structurally ambiguous mappings" to the always-ask category in `references/decision-taxonomy.md`.
- Marketplace metadata in the source had no target equivalent; correct default is drop + recommend a config snippet for the user to paste manually, never auto-edit the user's config. Codified in the taxonomy as a silent-default with a config-recommend-only carve-out.
- Dependency-graph constructs in the source (Task* with `addBlockedBy`) had no clean flat-todo target equivalent — confirmed as a lossy-translation always-ask case.
- Step 2's batched three-question prompt asked too much up front; install scope and doc hints both have defensible defaults. Reduced to one mandatory question (target harness) with the other two deferred behind weak-signal triggers.

---

## 2026-04-25 — copilotkit → opencode (`.agents/`)

- **MCP server declarations are part of the plugin contract, not user preference.** The original `marketplace metadata` rule generalized too far and treated `.mcp.json` as a "recommend-only" config edit. Result: rewriter wrote nothing, MCP servers silently absent, plugin's tool layer broken. Fix: added taxonomy category 13 (MCP Server Declarations) and a dedicated silent-default that MERGES the server entry into the target's project config (e.g. `opencode.json`), translating transport keys (`http` → `remote`). Recorded as a `silent_assumptions` entry, not an `open_questions`.
- **Rewriter copied plugin-repo metadata to install location** (README.md, LICENSE, SECURITY.md, scripts/ from the source repo). These are upstream-repo concerns; they do not belong in `.agents/`. Fix: hard "MUST NOT be written" list in `references/agents/rewriter.md` and a matching silent-default in `decision-taxonomy.md` (`plugin-repo-metadata-skipped`).
- **Install layout was ad-hoc per port.** Adopted the `birdcar-plugins/scripts/build-plugin-skills.ts` convention: skills flat under `{install}/skills/{name}/`, top-level `commands/` `hooks/` `references/` copied as-is when not relocated by mapping, everything else from plugin root → `{install}/.config/{plugin-name}/`.
- **Rejected "Path Variables" prose-block injection** as too noisy. Path variables get inline string replacement following the mapping table, with one `silent_assumptions` entry recording the resolution table (`category: path-variables-resolved`). No prose injected at the top of any file.
- **Transport key mismatch:** sources use `"type": "http"` (Claude Code MCP), OpenCode uses `"type": "remote"`. Same for `stdio` → `local`. Researcher mapping must include explicit `transport_translations` so the rewriter doesn't have to guess.

---
