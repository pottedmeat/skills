# Trigger Coverage for Harness-Agnostic Porting

This document audits the discoverability surface of the `plugin-porter` skill against its harness-agnostic capability claim. It inventories the activation phrases declared in `SKILL.md`'s `description` frontmatter and the validation queries in `trigger-tests.md`, then evaluates whether they cover the target space without baking in harness-specific assumptions.

The skill claims (per `docs/contract.md` Goals 1 and 4) to accept any Claude-style plugin and produce a working installation in any user-chosen target harness, researching that harness's conventions dynamically. Discoverability must match: trigger phrases must fire across arbitrary harness names and must not fire on adjacent tasks (skill creation, in-Claude installation, generic refactoring).

## Sources Audited

- `SKILL.md` lines 1–5 — frontmatter `description` field, the only string the agent harness loads to decide activation.
- `trigger-tests.md` lines 1–58 — 20-query validation suite split 10 should-trigger / 10 should-not-trigger.

Cross-references: `docs/contract.md` §Goals (items 1 and 4) and §Scope Boundaries.

## Trigger Phrase Inventory (from SKILL.md description)

The frontmatter `description` enumerates seven canonical trigger templates, each parameterized on `{harness}`:

| # | Phrase template | Verb |
|---|-----------------|------|
| 1 | "port this plugin to {harness}" | port |
| 2 | "adapt this Claude plugin for {harness}" | adapt |
| 3 | "convert plugin to {harness}" | convert |
| 4 | "install this plugin in {harness}" | install |
| 5 | "migrate plugin to {harness}" | migrate |
| 6 | "translate plugin for {harness}" | translate |
| 7 | "retarget plugin to {harness}" | retarget |

The description also names example harnesses parenthetically — Cursor, OpenCode, Agent Zero, Codex CLI — followed by `etc.` to signal the list is open.

### Verb coverage

The seven verbs span the natural semantic field for the operation: `port`, `migrate`, `convert`, `translate`, and `retarget` are near-synonyms emphasizing the rewrite; `adapt` emphasizes target-harness fit; `install` emphasizes the destination-side outcome. No major verb in this field is missing from the description.

## Negative-Case Inventory (from SKILL.md description)

The `Do NOT use` clause excludes three categories:

1. **Creating new skills** — explicitly delegates to `create-skill`.
2. **Installing a Claude plugin inside Claude Code itself** — excludes the Claude→Claude case, consistent with `docs/contract.md` §Scope Boundaries (Claude → other only; reverse direction listed under Future Considerations).
3. **General code refactoring unrelated to plugin format conversion** — excludes verb-overlap cases like "refactor" or "rename" that are not plugin-format work.

All three exclusions match the contract's scope. The Claude→Claude carve-out is essential because the `install` verb in the positive trigger list would otherwise collide with marketplace-install workflows that target Claude itself.

## Trigger-Tests Inventory

`trigger-tests.md` supplies 20 queries (10/10 split) with an expected activation rate of ≥9/10 on the should-trigger set and ≤1/10 on the should-not-trigger set.

### Should-trigger queries (10) and harness coverage

| # | Harness named | Verb | Notes |
|---|--------------|------|-------|
| 1 | Cursor | port | Exact phrase match |
| 2 | OpenCode | adapt | Exact phrase match |
| 3 | agent-zero | convert | Exact phrase match |
| 4 | Codex CLI | "make it work in" | Paraphrase — verb not in description |
| 5 | Cursor | move / rewrite | Paraphrase — verbs not in description |
| 6 | "different agent harness" (unspecified) | migrate | Paraphrase, no specific harness |
| 7 | OpenCode | retarget | Exact phrase match |
| 8 | agent-zero | translate | Exact phrase match |
| 9 | Cursor | port / install | Long context, paraphrase |
| 10 | agent-zero | install / convert | Long context, git URL source |

Distinct harnesses exercised: **Cursor (4), OpenCode (2), agent-zero (3), Codex CLI (1), unspecified (1)**. All four harnesses named parenthetically in the description appear at least once. Each harness appears with at least one paraphrased (non-exact-match) verb, which exercises the description's semantic rather than literal coverage.

### Should-not-trigger queries (10) by category

| # | Category | Routes to |
|---|----------|-----------|
| 11 | Skill creation | create-skill |
| 12 | Skill creation (Claude target) | create-skill |
| 13 | Verb-overlap (`port` = file format) | create-skill or general |
| 14 | Generic refactoring | general |
| 15 | Generic rename | general |
| 16 | Generic code move | general |
| 17 | Claude→Claude install | (none — explicitly out of scope) |
| 18 | Verb-overlap (`translate` = natural language) | general |
| 19 | Skill optimization | improve-skill |
| 20 | PR review | code-review-pro / pr-description |

Negative-case coverage maps cleanly to the three exclusion categories in the description:

- **Create-skill exclusion** — queries 11, 12, 13 (the latter also stresses the `port` verb-collision with file-format conversion).
- **In-Claude installation exclusion** — query 17.
- **Unrelated refactoring** — queries 14, 15, 16, 18.

Two additional cases (19, 20) defend against routing collisions with sibling skills in the same marketplace (`improve-skill`, `pr-description`), which is broader than the description's stated negative cases but consistent with the discoverability goal.

## Harness-Coverage Analysis

### Strengths

- The frontmatter writes every trigger phrase against a `{harness}` placeholder, so no template silently privileges any specific harness.
- The parenthetical "(Cursor, OpenCode, Agent Zero, Codex CLI, etc.)" terminates with `etc.`, preserving openness.
- `trigger-tests.md` exercises four distinct harnesses across the should-trigger set and includes one query (#6) with no specific harness named, which probes whether the skill fires when the user has not yet decided.
- The verb set in the description (port, adapt, convert, install, migrate, translate, retarget) is semantically broad enough that paraphrases like "make it work in" (query #4) and "move ... over to" (query #5) still activate via semantic similarity.

### Gaps and Uncertainty

The audit surfaces several gaps where natural user phrasing may not map cleanly to a description trigger phrase. Whether these gaps actually cause misses depends on the activating model's semantic-match tolerance, which this audit cannot measure directly — only fresh-session runs of `trigger-tests.md` can.

1. **"Make it work in {harness}"** — used in query #4 (Codex CLI) but not present in the description. Activation here relies on semantic generalization from `adapt`/`convert`. If activation rates dip on this query in tests, adding "make this plugin work in {harness}" as an explicit trigger would close the gap.

2. **"Move ... over to {harness}"** — used in query #5. Same risk as above; the verb `move` is closer to `migrate` than to any literal description phrase, but is not listed.

3. **"Set up this plugin for {harness}"** / **"Get this plugin running on {harness}"** — natural phrasings not present in the description and not exercised in `trigger-tests.md`. These are speculative gaps; user-data evidence would be needed to confirm they occur.

4. **Bare-source phrasings** — query #8 ("Translate the plugin in `./my-plugin/` for agent-zero") embeds the source path. The description doesn't model path-bearing variants explicitly, but the verb-and-target structure still matches. No remediation likely needed.

5. **Source-as-git-URL phrasings** — query #10 names a GitHub URL as the source. The description does not mention git URLs, though the contract supports them. Users who lead with the URL ("install this Claude plugin from `https://...` for agent-zero") rely entirely on the verb-and-target match. Adding a phrase like "install this Claude plugin from a git URL for {harness}" would be over-specific; the current coverage is likely sufficient, but this is a known semantic hop.

6. **Unnamed-target phrasings** — query #6 ("a different agent harness") tests a case where the user has not committed to a specific harness. The skill's Step 2 (per `SKILL.md` line 43) treats target as a free-text question, so post-activation the flow is well-defined; the question is purely whether the description fires without a concrete harness token. This is a known semantic-match-tolerance question rather than a coverage defect.

### Negative-case completeness

The negative-case section in the description correctly excludes:

- create-skill (covered by query 11, 12, 13)
- in-Claude installation (covered by query 17)
- general refactoring (covered by queries 14–16, 18)

One adjacent risk is **un-port-like installation phrasings** that target a non-Claude harness but read like marketplace installs (e.g. "install this OpenCode plugin"). The description's `install this plugin in {harness}` trigger is intended to capture the Claude→other case, and the negative clause carves out only Claude→Claude. A query phrased "install this OpenCode plugin in OpenCode" is genuinely out of scope (no Claude source) but is not exercised in `trigger-tests.md`. This is a coverage gap in the negative-case test set, not a description defect — the description's "Claude-style plugin" framing already implies a Claude source.

## Recommended Additions

Tracked here as candidate edits, not applied:

1. **SKILL.md description** — consider adding `"make this plugin work in {harness}"` and `"get this plugin running on {harness}"` to the trigger phrase list. These are common user phrasings adjacent to the existing verbs.

2. **trigger-tests.md (should-trigger)** — replace or augment one existing query with a non-Claude-source-but-claims-to-port case (e.g. "install this OpenCode plugin in Cursor") to confirm the skill rejects non-Claude sources at validation time (Step 1) rather than activating on the surface phrasing. Note this would test runtime validation, not the description; classify carefully before adding.

3. **trigger-tests.md (should-not-trigger)** — add a query phrased "install this OpenCode plugin in OpenCode" to exercise the same-harness-but-non-Claude-source negative case. Currently no query in the suite covers this.

4. **Harness-name diversity** — `trigger-tests.md` exercises the four harnesses named in the description plus one unspecified. Adding a fifth, never-named harness (e.g. "Continue", "Aider", a fictional name) would test true harness-agnosticism — that activation does not depend on the harness having appeared in the description.

These are recommendations for future revision, not findings of current defect. The existing coverage satisfies Goals 1 and 4 of `docs/contract.md` to the extent that static audit can verify; final confirmation requires fresh-session activation runs against the trigger-tests suite.

## Cross-References

- `docs/contract.md` Goal 1 — accepting a plugin and producing a working installation in any target harness; trigger phrases must not pre-filter the harness space.
- `docs/contract.md` Goal 4 — staying harness-agnostic by researching dynamically; trigger phrases must not embed a closed harness list.
- `SKILL.md` line 17 — "The skill is harness-agnostic — the researcher discovers conventions dynamically." Discoverability triggers must mirror this stance.
- `SKILL.md` line 43 — target harness is collected as free text, reinforcing that triggers must not pre-commit to a fixed list.
