# Verdict — plugin-porter Harness-Agnostic Porting Story

## Story

> The plugin-porter skill should be adept at converting Claude plugins to run within any harness through environment exploration, research, and user input.

## Verdict

**Cogent and grounded.** All blocking gaps identified during the
cogency pass have been resolved. Two minor scanner-coverage gaps (G2,
G3) remain as documented follow-ups; they do not invalidate the
story's core claim.

## Pillar Evidence

### Pillar 1 — Environment exploration (scanner)

- All thirteen taxonomy categories from `references/harness-concepts.md`
  are emitted by the scanner. Coverage matrix in
  `scanner-coverage.md`.
- Scanner is harness-agnostic: it classifies *what is in the source
  plugin*, never reasons about target harness equivalents.
- Doc-drift fix applied: three references previously said "twelve
  categories" — now corrected to "thirteen" in
  `references/harness-concepts.md`, `references/agents/scanner.md`,
  and `docs/spec.md`.

### Pillar 2 — Research (researcher subagent)

- Harness-agnostic: `meta.target_harness` is opaque free text; no
  hardcoded harness branches anywhere in `references/agents/researcher.md`.
- **Multi-source research escalation ladder** (added during the
  cogency pass) ensures the researcher never guesses based on shallow
  signal:
  - **Open-source harness**: DeepWiki + Context7 in parallel →
    WebFetch followup → Perplexity tiebreaker → `open_questions`.
  - **Closed-source / unknown**: Perplexity first → WebFetch
    followup → Context7 attempt → `open_questions`.
- **Anti-guess rule (binding)**: every `mappings` entry must cite the
  source tier and query that produced the answer. A mapping written
  without traceable research evidence is a bug.
- All five previously-implicit taxonomy gaps now have explicit policy
  entries in `references/decision-taxonomy.md`:
  - Model alias disambiguation (always-ask)
  - Non-permission hook events (silent-default with recommend-only
    fallback)
  - `$ARGUMENTS` / command argument variables (silent-default,
    separated from filesystem path variables)
  - Marketplace registry translation (silent-default, recommend-only)
  - "flag" verb in `harness-concepts.md` Summary Table mapped
    explicitly to always-ask via "Lossy semantic translations."

### Pillar 3 — User input (parent skill)

- Only the parent calls `AskUserQuestion`. Subagents lack the tool
  and route ambiguity through `open_questions` and `blockers`. See
  `subagent-boundaries.md` for the 3×5 compliance matrix.
- The three-bucket policy (silent-default / ask-rarely / always-ask)
  is now exhaustive over the thirteen categories. No category falls
  through the cracks.

## Cogency Issues Found and Resolved

1. ✅ **Twelve vs. thirteen drift** — fixed in 3 files.
2. ✅ **Model alias disambiguation** — explicit always-ask entry added.
3. ✅ **Non-permission hooks** — explicit silent-default entry added.
4. ✅ **Command/skill loss "flag" verb** — explicit mapping to
   always-ask added.
5. ✅ **`$ARGUMENTS` runtime variables** — separated from filesystem
   path variables; explicit silent-default entry added.
6. ✅ **Marketplace "translate" branch** — explicit silent-default
   entry added (recommend-only output).
7. ✅ **Researcher could guess on weak signal** — added MCP research
   tools (DeepWiki, Context7, Perplexity), branching escalation
   ladder, and anti-guess binding rule.

## Remaining Follow-Ups (Non-Blocking)

- **Scanner gap G2** (per `scanner-coverage.md`): tool-name detection
  in prose is under-specified. The scanner detects YAML `tools:` /
  `allowed-tools:` fields reliably but may miss capitalized tool
  references in skill prose. Impact is low for harnesses with
  identical tool inventories; higher when the target renames many
  tools.
- **Scanner gap G3** (per `scanner-coverage.md`): cross-skill
  `${CLAUDE_PLUGIN_ROOT}` references (skill A pointing at skill B's
  files via the plugin root) are detected but not separately tagged.
  Impact is layout-specific and rare.

Both gaps are tracked in `scanner-coverage.md`. They affect scanner
*precision*, not the story's three-pillar architecture.

## Files Modified This Session

| File | Change |
|---|---|
| `references/harness-concepts.md` | Line 3 wording; Summary Table rows 3, 5, 6, 7, 8, 11 disambiguated |
| `references/decision-taxonomy.md` | Added 4 new entries (Command argument variables, Non-permission hook events, Marketplace registry translation, Model alias disambiguation) and a "flag" verb cross-reference |
| `references/agents/scanner.md` | "twelve-category" → "thirteen-category" |
| `references/agents/researcher.md` | Added MCP tool grant; added Research escalation ladder section; added Anti-guess rule; updated Decision rule, Workflow, Forbidden, and Blocker sections |
| `docs/spec.md` | "twelve taxonomy categories" → "thirteen taxonomy categories" |
| `docs/plugin-porter-harness-agnostic-porting/researcher-behavior.md` | Tools row updated to reflect new MCP grant |

## Audit Trail

Six audit pages produced during Phase 4 of the validate-story
workflow:

- `scanner-coverage.md` — coverage matrix for the 13 categories.
- `researcher-behavior.md` — researcher contract.
- `subagent-boundaries.md` — 3×5 compliance matrix (no subagent has
  AskUserQuestion).
- `rewriter-fidelity.md` — rewrite-category coverage (12/12).
- `taxonomy-alignment.md` — alignment matrix and original gap
  inventory (Gaps 1–5).
- `trigger-coverage.md` — trigger inventory and harness-coverage
  analysis (4+ harnesses, all parameterized).

Each is independently usable as evidence for future audits.
