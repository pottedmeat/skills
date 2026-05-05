# Report Schemas — DEPRECATED

This file described the legacy three-report architecture (`scanner-report.md`, `researcher-report.md`, `rewriter-summary.md`) where each subagent owned its own document and the parent skill orchestrated via terminal-message return values.

That architecture had a recurring failure mode: subagents faced unresolved decisions, and the harness's interactive-prompt fallback would fire as their terminal message — surfacing prompts the parent could not see or attribute.

## Current architecture

All coordination now flows through a single shared document, `port-plan.md`. See:

- **`references/port-plan-schema.md`** — full schema for `port-plan.md`, section ownership, state machine, editing rules, and resumability.
- **`references/agents/scanner.md`** — scanner agent (writes `findings`).
- **`references/agents/researcher.md`** — researcher agent (writes `mappings`, `silent_assumptions`, `open_questions`).
- **`references/agents/rewriter.md`** — rewriter agent (writes `rewrite_log`).
- **`SKILL.md`** — parent state-machine orchestrator.

This file is retained only as a redirect for any external links. Do not author new content here.
