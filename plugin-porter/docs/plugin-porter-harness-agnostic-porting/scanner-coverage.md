# Scanner Coverage Audit

This page audits whether the plugin-porter scanner subagent
(`references/agents/scanner.md`) issues explicit detection instructions for
every Claude-plugin concept category enumerated in the harness-concepts
taxonomy (`references/harness-concepts.md`). Scanner coverage is the
foundation of plugin-porter's "environment exploration" promise
(`docs/contract.md` Goal #1, `docs/spec.md` scanner purpose): any category
that is silently omitted, ambiguously instructed, or only partially handled
becomes a class of Claude-specific construct that can leak unported into the
target harness.

## Taxonomy size: 12 stated, 13 actual

`docs/spec.md` and the in-line scanner narrative both refer to "the twelve
taxonomy categories" (see `references/agents/scanner.md` line 88 of spec
component manifest, and `harness-concepts.md` line 3: "Every Claude
construct ... falls into exactly one of these categories"). The taxonomy
file itself, however, defines **thirteen** numbered sections — `#13. MCP
Server Declarations` was added without updating the "twelve" wording in
neighbouring documents.

This audit treats all thirteen sections as the canonical category list,
because the scanner instructions explicitly enumerate MCP server detection
in step 4 of its workflow. The "twelve" label is a documentation drift bug,
not a scope decision. See **Gaps** below.

## Coverage matrix

Each row is one taxonomy category. *Detected?* indicates whether the
scanner is given an explicit detection instruction (✅), an instruction that
is present but vague or under-specified (⚠️), or no instruction at all
(❌). Evidence quotes are taken verbatim from `scanner.md` step 4 (lines
42–55) unless otherwise noted.

| #  | Category                          | Detected? | Evidence (scanner.md)                                                                                                                          |
|----|-----------------------------------|-----------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | Path Variables                    | ✅        | "**Path variables**: `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_SKILL_DIR}`, `${CLAUDE_SESSION_ID}`, `$ARGUMENTS`, etc." (line 43)                       |
| 2  | Built-in Tool Names               | ⚠️        | "**Tool names**: in YAML `tools:`/`allowed-tools:` and prose. Focus on built-in tool names." (line 44) — no explicit list of names to match     |
| 3  | Model Aliases                     | ✅        | "**Model aliases**: `model:` frontmatter values and prose mentions of `opus`/`sonnet`/`haiku`." (line 45)                                       |
| 4  | Agent Frontmatter Schema          | ✅        | "**Agent frontmatter**: every `agents/*.md` — one finding per agent file." (line 46)                                                            |
| 5  | Slash Command Frontmatter Schema  | ✅        | "**Command frontmatter**: every `commands/*.md` — one finding per command." (line 47)                                                           |
| 6  | Skill Frontmatter Schema          | ✅        | "**Skill frontmatter**: every `SKILL.md` — one finding per skill." (line 48)                                                                    |
| 7  | Hooks                             | ✅        | "**Hooks**: `hooks/hooks.json` and referenced scripts." (line 49)                                                                               |
| 8  | plugin.json Metadata              | ✅        | "**plugin.json**: root `plugin.json` if present." (line 50)                                                                                     |
| 9  | Shared Directory & Plugin-Scoped References | ⚠️ | "**Shared dir**: `shared/` subpaths." (line 51) — covers the directory but not `${CLAUDE_PLUGIN_ROOT}` cross-skill references called out in taxonomy §9 |
| 10 | Local Config Pattern              | ✅        | "**Local config**: `config.local.md`, `.env*` templates, bootstrap scripts." (line 52)                                                          |
| 11 | Marketplace Metadata              | ✅        | "**Marketplace metadata**: `.claude-plugin/marketplace.json`, marketplace install instructions." (line 53)                                       |
| 12 | Prose References to Claude        | ✅        | "**Prose Claude references**: `\b(claude\|anthropic)\b` (case-insensitive). De-duplicate per file (≤3 per file, ≤30 total)." (line 54)          |
| 13 | MCP Server Declarations           | ✅        | "**MCP server declarations**: presence of `.mcp.json` at the plugin root, an `mcpServers` key in `plugin.json` or any SKILL.md frontmatter ..." (line 55) |

## Findings-schema alignment

The `findings` entries the scanner produces map cleanly onto the taxonomy.
Per `references/port-plan-schema.md` (lines 124–131):

```yaml
- id: F001
  category: <string>        # exact name from references/harness-concepts.md
  file: <relative path>
  line: <int|null>
  construct: <string>
  raw_snippet: <string>
```

The schema's comment "exact name from `references/harness-concepts.md`"
explicitly couples each finding to one taxonomy category, and the scanner
instructions (step 4) iterate the same category list when emitting
findings. There is therefore no structural mismatch between scan output
and taxonomy — the contract is enforced by the `category` field's
documented value space. The one observable looseness is that
`harness-concepts.md` does not publish a canonical machine-readable list
of category strings, so an out-of-vocabulary `category:` value in a
finding would only be caught by a human reader of the plan.

## Gaps

### G1 — "Twelve" vs. thirteen drift

`docs/spec.md` and `harness-concepts.md` line 3 still say "twelve
categories" while the taxonomy enumerates thirteen (MCP server
declarations was added later). The scanner instructions correctly cover
all thirteen, so this is documentation drift rather than a scan-coverage
hole, but downstream readers (and any future agents that summarize
"the twelve categories") will be off-by-one.

### G2 — Tool-name detection is under-specified

For category #2, the taxonomy lists 14 common Claude tool names
(`Read`, `Write`, `Edit`, `Glob`, `Grep`, `Bash`, `Task`, `WebFetch`,
`AskUserQuestion`, `TodoWrite`, `NotebookEdit`, `SlashCommand`,
`MultiEdit`, `Skill`) and notes they appear in YAML lists *and* prose
("Use the AskUserQuestion tool"). The scanner instruction says only
"Focus on built-in tool names" without enumerating which names to match
or how to disambiguate them from common English verbs in prose (e.g.
"read", "write"). A scanner that interprets this conservatively will
catch YAML occurrences but may miss the prose mentions the taxonomy
explicitly calls out. **Uncertainty**: how aggressive the scanner is in
prose depends on subagent judgment, which is exactly the kind of
implicit decision the plugin-porter contract avoids elsewhere.

### G3 — Shared/plugin-scoped references partially covered

Taxonomy §9 covers two distinct signals: (a) presence of a `shared/`
directory, and (b) any `${CLAUDE_PLUGIN_ROOT}`-prefixed reference that
points outside the current skill's directory (cross-skill imports of
shared assets). The scanner instruction `"shared/ subpaths"` covers
signal (a) explicitly. Signal (b) is implicitly covered by the
path-variable detector (category #1, since `${CLAUDE_PLUGIN_ROOT}` is
in the listed token set), but the cross-skill semantics — the fact
that such a reference *also* implies a shared-asset relocation
decision, not just a path rewrite — are not surfaced. A finding for a
`${CLAUDE_PLUGIN_ROOT}/shared/foo` reference will be classified as
category #1 (Path Variables) and lose the category-#9 framing. The
researcher would need to re-derive the shared-asset semantics from the
raw snippet.

### G4 — Hook script discovery depends on `hooks.json` parsing

The instruction `"hooks/hooks.json and referenced scripts"` (line 49)
delegates the discovery of *which* scripts to scan to whatever the
scanner extracts from `hooks.json`. If the JSON is malformed, references
scripts via a non-standard key, or uses globs, the scanner has no
fallback rule. There is no instruction to also enumerate any executable
files under `hooks/` independently of what the JSON references. This is
a minor gap; in well-formed plugins the JSON will name every relevant
script.

### G5 — No size/exclusion rules for prose-Claude scan

The scanner is told to deduplicate prose Claude references "≤3 per file,
≤30 total" (line 54), but no comparable cap or sampling rule is given
for any other category. For a large plugin this is intentional — every
agent, command, and skill should produce its own finding — but the
inconsistency means the scanner's reasoning about "when is N enough"
varies per category by author judgment. Glob-level exclusions
(`node_modules/`, `dist/`, `.git/`, `*.lock`, binaries, files >500 KB)
*are* specified at line 41 and apply uniformly.

### G6 — No category for unknown/unclassifiable constructs

The scanner workflow assumes every finding fits one of the thirteen
categories. The taxonomy's framing ("Every Claude construct ... falls
into exactly one of these categories") leaves no room for "I found
something Claude-shaped but it doesn't match any category." The escape
hatch is `blockers`, but blockers terminate the scan; there is no
mechanism for "log this oddity but keep scanning." A truly novel
Claude construct (e.g. a future Anthropic-shipped convention not yet
in the taxonomy) would either be force-fit into a category or quietly
dropped.

## Recommendations

These are observations for future work on the scanner; this page is an
audit, not a change order:

1. **Reconcile "twelve" vs. thirteen.** Update
   `harness-concepts.md` line 3 and `docs/spec.md` references to say
   "thirteen" (or whatever the live count is), and consider numbering
   the taxonomy in a single canonical place to prevent future drift.
2. **Inline an explicit tool-name list in the scanner instruction.**
   Copy the 14-name list from `harness-concepts.md` §2 directly into
   `scanner.md` step 4 so the scanner is not relying on subagent recall.
   Optionally, separate "YAML occurrence" rules from "prose occurrence"
   rules and give the latter a clearer heuristic.
3. **Make cross-skill `${CLAUDE_PLUGIN_ROOT}` a first-class
   shared-asset signal.** Either emit two findings (one per category)
   for cross-skill references, or have the scanner classify
   `${CLAUDE_PLUGIN_ROOT}/shared/...` paths as category #9 by default
   and other `${CLAUDE_PLUGIN_ROOT}` paths as category #1.
4. **Add a `category: unknown` finding type** as an escape valve for
   Claude-shaped constructs that don't match the taxonomy, so novel
   constructs surface to the researcher rather than being dropped or
   forcing a blocker.

## Cross-references

- `references/harness-concepts.md` — taxonomy of 13 categories.
- `references/agents/scanner.md` — scanner subagent instructions
  (workflow at lines 38–58).
- `references/port-plan-schema.md` — `findings` entry schema (lines
  122–131) and section ownership table (lines 82–93).
- `docs/spec.md` — scanner component description (Per-Component Details
  → `references/agents/scanner.md`).
- `docs/contract.md` — Goal #1 (port any Claude plugin) and Success
  Criterion "the skill produces a `port-plan.md` whose `findings`
  section enumerates every Claude-specific construct."
