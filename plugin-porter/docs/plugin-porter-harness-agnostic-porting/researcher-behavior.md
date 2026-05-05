# Researcher Behavior Contract

The researcher subagent is the bridge between the scanner's harness-agnostic findings and the rewriter's harness-specific output. It is the only role in plugin-porter that performs target-harness research, and the only role authorized to populate `mappings`. This document specifies its inputs, outputs, side effects, and behavior under each operational scenario.

## Role summary

| Property | Value |
|---|---|
| Source file | `references/agents/researcher.md` |
| Model | `sonnet` |
| Tools | `Read`, `WebFetch`, `Edit`, plus MCP research tools: `deepwiki__ask_question`, `deepwiki__read_wiki_structure`, `deepwiki__read_wiki_contents`, `context7__resolve-library-id`, `context7__query-docs`, `perplexity_ask__perplexity_ask` (no `AskUserQuestion`, no `Bash`, no `Write`) |
| Owns | `mappings` (primary), `silent_assumptions` (append), `open_questions` entries with `answer: null` (append), `blockers` (append on hard failure), `meta.updated_at` |
| Forbidden | Modifying `findings`, `rewrite_log`, `status`, or any `open_questions[].answer` field |
| Returns | One terminal line. No data, no questions, no prose |

The researcher does not call `AskUserQuestion` because it does not have access to the tool. Every user-facing decision is recorded as an `open_questions` entry; the parent skill is the only role permitted to surface and answer those questions.

## Inputs

The parent passes a single value in the spawn prompt:

- `port_plan_path` — absolute path to `port-plan.md`.

Every other input lives inside `port-plan.md` itself:

- `meta.target_harness` — free-text string supplied by the user at Step 2 of the parent workflow. The researcher treats this as the authoritative target identifier; there is no enumerated allow-list.
- `meta.docs_hints` — optional list of URLs the parent or user supplied. Empty by default; populated only when the user answered a prior `docs-unreachable` question or volunteered hints upfront.
- `meta.install_location` — used to compute target config paths for MCP server merges.
- `findings` — the scanner's complete output. Read-only for the researcher.
- `open_questions` — on re-invocation, this section already exists with some entries' `answer` fields populated by the parent.

The researcher also reads three reference files whose paths are injected into its spawn prompt:

- `taxonomy_path` → `references/harness-concepts.md` (finding categories).
- `decision_taxonomy_path` → `references/decision-taxonomy.md` (silent-default vs ask-rarely vs always-ask).
- `schema_path` → `references/port-plan-schema.md` (entry shapes).

## Outputs and side effects

The researcher's only side effect is in-place `Edit` operations on `port-plan.md`. It writes to four sections:

1. `mappings` — one entry per `findings[]` entry it can resolve. Schema in `port-plan-schema.md`.
2. `silent_assumptions` — append-only. One entry per silently-defaulted decision, with a `taxonomy_ref` citation back to the section of `decision-taxonomy.md` that authorized the default.
3. `open_questions` — append-only entries with `answer: null`. Schema in `port-plan-schema.md`. The researcher never modifies the `answer` field; that is exclusively the parent's responsibility.
4. `blockers` — append-only. Used only when the researcher cannot proceed (see "Blockers" below).

`meta.updated_at` is bumped on every write.

The terminal message is exactly one of:

- `mappings: M, open_questions: K (unanswered: U)` (success — the parent decides the next state transition based on `U` and `mappings` coverage).
- `blocked: <one-line reason>` (failure — a corresponding `blockers` entry has already been written).

No other terminal output is permitted. No prose, no questions, no narrative.

## Discovery: how the researcher learns target-harness conventions

The researcher discovers target-harness conventions dynamically. There is no hardcoded knowledge of any specific harness anywhere in the researcher's instructions or in the decision taxonomy. Discovery flows in three layers:

1. **`meta.docs_hints`** — if non-empty, fetch these URLs first. They are the user's curated entry points and take precedence over open-web search.
2. **WebFetch on the value of `meta.target_harness`** — the researcher uses the free-text harness name to fetch official documentation. The instruction file directs the researcher to "WebFetch target-harness docs as needed" and to "prefer one broad fetch per category over many narrow ones" (`references/agents/researcher.md`:52). The exact URL strategy is left to the agent's judgment; no URL templates are baked in.
3. **References for finding categories** — `harness-concepts.md` defines what each finding category *means* harness-agnostically (what concept is being represented), giving the researcher a target-independent vocabulary to translate into.

The combination produces a fully harness-agnostic discovery loop: `meta.target_harness` is opaque free text, `harness-concepts.md` is harness-neutral, and `decision-taxonomy.md` is harness-neutral. All harness-specific knowledge is acquired at runtime through `WebFetch` and recorded in the `mappings` and `silent_assumptions` it writes.

The researcher's instructions contain a single illustrative example for the `mcp-server-declaration` category, listing concrete OpenCode and Cursor key names (`references/agents/researcher.md`:74–83). This is documentation example text describing the *shape* of a mapping entry — it is not a hardcoded branch the researcher executes. The researcher would still need to verify those keys against current docs for the actual `target_harness` it is processing.

## Behavior under each scenario

### First invocation (status: `researching`, no prior `open_questions`)

1. Read `port-plan.md`. Verify `status == researching`. If not, append a `blockers` entry and terminate.
2. Read `harness-concepts.md`, `decision-taxonomy.md`, `port-plan-schema.md`.
3. For each `findings[]` entry, classify against `decision-taxonomy.md`:
   - **Silent-default authorized** → apply the default, write a `mappings` entry with `confidence: medium`, append a `silent_assumptions` entry citing the taxonomy section.
   - **Direct mapping** (taxonomy plus harness docs give an unambiguous target) → write a `mappings` entry with `confidence: high`. No assumption recorded (no judgment was exercised).
   - **Always-ask**, **structurally ambiguous**, or **target docs unreachable for this category** → append an `open_questions` entry with `answer: null`. Do **not** write a `mappings` entry for this finding yet.
4. WebFetch target-harness docs as needed during step 3.
5. Terminate with `mappings: M, open_questions: K (unanswered: U)`.

The decision rule is summarized in the researcher's own words: "When in doubt: ask. A pending `open_questions` entry is cheap; a wrong silent default is expensive" (`references/agents/researcher.md`:72).

### WebFetch returns nothing useful or target docs are sparse

The researcher does not invent mappings under documentation uncertainty. The instructions explicitly classify "target docs unreachable" alongside "always-ask" and "structurally ambiguous" as a trigger for writing an `open_questions` entry rather than a `mappings` entry (`references/agents/researcher.md`:51).

The `open_questions` entry uses category `docs-unreachable` (one of the four enumerated categories in `port-plan-schema.md`:47). The entry asks the user for one of:

- A documentation URL the researcher should fetch.
- A direct answer to the specific mapping question.
- An acknowledgment that the user has none, in which case the researcher will, on re-invocation, proceed with a low-confidence mapping (per `SKILL.md`:212: "if the user has none, researcher proceeds with low-confidence mappings").

The researcher writes the `open_questions` entry with `answer: null`, terminates with the standard one-liner, and the parent transitions `status` to `awaiting-user` and surfaces the question via `AskUserQuestion`.

### Re-invocation (status: `researching`, `open_questions` answers populated)

The parent re-spawns the researcher after filling `open_questions[].answer` values. On re-invocation, the researcher:

1. Reads `port-plan.md`.
2. For each `open_questions` entry where `answer != null` **AND** there is no corresponding `mappings` entry yet:
   - Translates the answer into a `mappings` entry. Appends.
   - Optionally appends a `silent_assumptions` entry if the answer triggers downstream defaults.
3. Verifies every `finding_id` in `findings` is covered by exactly one `mappings` entry. If gaps remain because some `open_questions` are still unanswered, terminates with the same one-liner; the parent will surface the remaining questions.
4. Terminates with `mappings: M, open_questions: K (unanswered: U)`.

The `U == 0` AND full-coverage state is what triggers the parent to transition `status: researching → mapped` (`references/port-plan-schema.md`:115).

## Idempotency rules

The researcher is idempotent across invocations. Two specific guarantees:

1. **Already-resolved questions are not re-processed.** The re-invocation algorithm explicitly skips `open_questions` entries that already have a corresponding `mappings` entry: it processes only entries where `answer != null` AND no mapping exists yet (`references/agents/researcher.md`:58–60). Re-running the researcher after a partial resolution will never duplicate mapping entries or rewrite earlier ones.
2. **The `answer` field is never written by the researcher.** The instructions state this twice: "never modify the `answer` field — that is the parent's responsibility" (line 36) and "Do not pre-fill `answer` yourself" (line 101). This guarantees that re-invocation cannot corrupt user input, and that a stale researcher run cannot race the parent's `Edit` of an answer.

`meta.updated_at` is bumped on every successful write so that resumability tooling can detect activity, but no semantic state is encoded outside the four owned sections.

## Harness-agnostic guarantees

The researcher contains no hardcoded harness branching. The evidence:

- The researcher's instruction file (`references/agents/researcher.md`) treats `meta.target_harness` as opaque free text. Discovery is delegated to `WebFetch` against whatever the user typed.
- `decision-taxonomy.md` is explicitly harness-agnostic: "All categories below are expressed in harness-agnostic terms. Harness-specific knowledge lives in the researcher's WebFetch output and the researcher report — never inline in this taxonomy" (`references/decision-taxonomy.md`:5).
- `harness-concepts.md` defines source-side categories (what a finding *is*), not target-side mappings (what it becomes).
- Per-`mcp-server-declaration` instructions contain example key names for OpenCode and Cursor (`references/agents/researcher.md`:74–83). These are authoring examples illustrating the required *shape* of the structured `target_construct` object (`target_config_path`, `target_config_key`, `transport_translations`, `server_entry`). They are not conditional branches; the researcher is still required to verify the actual key names for `meta.target_harness` against live docs.

A new target harness can be ported to without modifying the researcher, the decision taxonomy, or the schema. The only file that legitimately accumulates harness-specific knowledge over time is `docs/learnings.md`, which the parent (not the researcher) appends to at the end of a run.

## The two round-trip shapes

A finding takes one of two paths from scan to mapping:

### Path A — silent-default round trip

```
scanner: finding → researcher: classify (silent-default) → researcher: write mappings + silent_assumptions → done
```

No user interaction. The decision is recorded in `silent_assumptions` for post-run audit.

### Path B — open-question round trip

```
scanner: finding
  → researcher (pass 1): classify (always-ask | ambiguous | docs-unreachable)
  → researcher (pass 1): write open_questions[answer: null]
  → parent: status → awaiting-user
  → parent: AskUserQuestion for each unanswered entry
  → parent: Edit answer into open_questions[].answer
  → parent: status → researching, re-spawn researcher
  → researcher (pass 2): read answers, write mappings (+ optional silent_assumptions)
  → done
```

The loop between `awaiting-user` and `researching` can iterate if a researcher pass discovers new ambiguities after consuming earlier answers, but in practice each finding traverses Path A or Path B exactly once.

## Blockers

The researcher writes a `blockers` entry and terminates only when:

- Target harness docs are completely unreachable **AND** `meta.docs_hints` is empty **AND** the researcher has already written an `open_questions` entry asking for hints in a prior pass (`references/agents/researcher.md`:104–106).
- The schema-required structure of `port-plan.md` is malformed in a way the researcher cannot recover from.
- The researcher is invoked when `status` is not `researching` (a contract violation by the parent).

A blocker terminates the researcher with `blocked: <one-line reason>`. The parent then reads the latest `blockers` entry and decides whether to surface to the user, auto-remediate, or halt (per `SKILL.md` "Handling blockers").

## Cross-references

- `SKILL.md` Step 6 — parent dispatch logic for the researcher (`SKILL.md`:124–139).
- `SKILL.md` Step 7 — parent surfacing of `open_questions` and re-dispatch (`SKILL.md`:142–153).
- `SKILL.md` "Idempotency and resumability" — explicit statement of researcher idempotency (`SKILL.md`:206).
- `references/decision-taxonomy.md` — the silent-default / ask-rarely / always-ask classification the researcher consults for every finding.
- `references/port-plan-schema.md` § "open_questions entry", § "mappings entry", § Section ownership table — the schemas and write-permission contracts.
- `docs/spec.md` § "Per-Component Details / researcher.md" — design-level rationale (cross-referenced for context; not duplicated here).

## Areas of explicit uncertainty

The instructions are silent on the following points; implementations should treat these as undefined behavior to be clarified by future revisions rather than assumed:

- **WebFetch retry policy.** The researcher is told to fetch docs and to prefer broad over narrow fetches, but no retry count, backoff, or timeout policy is specified. A transient fetch failure on the first pass is not formally distinguished from "docs unreachable."
- **Multiple-answer handling on a single `open_questions` entry.** The schema permits `options` of 2–4 strings and an `answer` field that is `string | null`. Whether the parent may write a list (multi-select) into `answer`, and whether the researcher must accept that, is not explicitly specified in the researcher's instructions. The parent's Step 7 mentions multi-select shape but the researcher contract treats `answer` as scalar.
- **Confidence assignment heuristics.** `confidence: high | medium | low` values are referenced (`high` for direct mapping, `medium` for silent-default) but `low` is mentioned only in the context of post-`docs-unreachable` fallback (`SKILL.md`:212) without precise criteria.
- **Cross-finding consistency.** When two findings share an underlying decision (e.g. two skills that both reference the same path variable), the researcher is not explicitly directed to coalesce them into a single `open_questions` entry vs ask twice. The schema permits `finding_id: null` for cross-cutting questions but no rule mandates its use.

These should be tightened in future revisions of `references/agents/researcher.md` if real-world runs surface the gaps.
