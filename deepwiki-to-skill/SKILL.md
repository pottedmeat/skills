---
name: deepwiki-to-skill
description: Converts DeepWiki documentation from a GitHub repository into a reusable local skill (Cursor, Agent Zero, OpenCode, or any harness using SKILL.md + references/). Verifies DeepWiki tool access, captures raw wiki structure and contents, splits pages into stable reference files, rebuilds a linked hierarchy, and generates a concise SKILL.md with progressive disclosure. Use when the user asks to "convert DeepWiki to a skill", "make a skill from this repo's wiki", "turn DeepWiki into references", "document this GitHub repo as a skill", or wants reusable per-repo documentation derived from DeepWiki output. Do NOT use when the repo has no DeepWiki coverage, when generating skills from source code (use create-skill instead), or for ad hoc repo Q&A (call DeepWiki MCP directly).
---

# DeepWiki to Skill

Convert DeepWiki wiki structure and wiki content output into a local skill (Cursor, Agent Zero, OpenCode, or any harness consuming a `SKILL.md` + `references/` layout) with progressive disclosure: a concise `SKILL.md` plus `references/*.md` files loaded on demand.

## Non-negotiables

- **Never produce partial output.** If any MCP call, script, or validation step fails, stop immediately and report the exact failure. A partial skill is worse than no skill — it looks correct but misleads every later session.
- **Reuse the persisted slug map.** Structure links MUST come from `references/_slug-map.json`. Never recompute slugs independently in step 4.
- **Treat `---` inside page bodies as content.** Strip only the synthetic page-boundary separator (a trailing `---` immediately before the next `#` heading).
- **Do not reimplement the bundled scripts inline.** If `scripts/split-pages.js` or `scripts/build-structure.js` is missing or fails, stop and ask the user to restore it. Re-deriving slug rules across runs breaks determinism and silently corrupts structure links.
- **Frontmatter portability.** The generated skill's frontmatter should contain only `name` and `description`. Harness-specific fields (`allowed-tools`, `version`, etc.) are not portable across Cursor / OpenCode / Agent Zero / Claude Code.

## When to use

Use this skill when the user:

- wants to create a local skill from a GitHub repo's DeepWiki documentation
- asks to convert DeepWiki output into Cursor or Agent Zero skill files
- wants repo knowledge captured as a reusable skill instead of ad hoc notes

Do not use this skill when:

- the repo has no DeepWiki documentation
- the user wants a skill generated from source code rather than DeepWiki content
- DeepWiki MCP access is unavailable and cannot be enabled

## Prerequisites

- DeepWiki MCP is enabled with tools for reading wiki structure and full wiki content
- The user provides a repo in `owner/repo` form
- Ask the user whether the generated skill should be a project skill (`.cursor/skills/<skill-dir>/`) or a personal skill (`~/.cursor/skills/<skill-dir>/`)
- If `<skill-dir>/SKILL.md` already exists at the chosen destination, warn before overwriting

## Workflow

### 1. Verify DeepWiki access and choose destination

Before doing any conversion work:

1. List available MCP tools whose names contain `wiki` or `deepwiki`.
2. Identify the **structure tool**: accepts `repoName`, returns a hierarchical bullet list (typically `read_wiki_structure`).
3. Identify the **contents tool**: accepts `repoName`, returns a single markdown blob with `# Page:` markers (typically `read_wiki_contents`).
4. If either tool is missing, stop and ask the user to enable DeepWiki MCP. Do not proceed with only one of the two.
5. Ask whether the output should be a project skill or a personal skill, using whatever skills directory convention the host harness uses (e.g. `.cursor/skills/<skill-dir>/` vs `~/.cursor/skills/<skill-dir>/`, or the equivalent for Agent Zero / OpenCode / Claude Code).
6. Resolve the final skill directory name before creating files. If `<skill-dir>/SKILL.md` already exists at the chosen destination, warn before overwriting.

### 2. Fetch and store raw data

Call the DeepWiki MCP tools that read:

- wiki structure with `repoName: "owner/repo"`
- full wiki contents with `repoName: "owner/repo"`

Create the output directory at the user-selected destination:

```
<chosen-skill-root>/<skill-dir>/
├── raw/
│   ├── wiki-structure.txt
│   └── wiki-contents.md
```

Directory naming rule:

- **Prefer repo name alone** when it is descriptive, such as `react-native-gifted-charts`, `next.js`, or `prisma`
- **Use `<owner>-<repo>`** only when the repo name is generic or ambiguous, such as `vercel-ai` for `vercel/ai`
- Include the owner only when it adds real disambiguation value

Save the structure output to `raw/wiki-structure.txt` and the content output to `raw/wiki-contents.md`.

Stop immediately and report the exact problem if either MCP call:

- fails
- returns empty data
- returns malformed data
- indicates repo-not-found, auth, network, or rate-limit problems

Do not continue with partial input.

### 3. Split pages into references with stable unique filenames

Split `raw/wiki-contents.md` by `# Page: [Title]` markers into `references/*.md`.

Required invariants:

- Pages are delimited by `\n# Page: ` and the first page starts at line 1 with no leading delimiter
- Each page body typically starts with its own H1, such as `# Overview`
- Create exactly one reference file per page
- Use deterministic readable slugs
- If multiple titles collapse to the same slug, disambiguate predictably as `slug.md`, `slug-2.md`, `slug-3.md`
- Persist the title-to-filename mapping so later steps reuse the exact same filenames
- Preserve leading indentation and any indentation-sensitive markdown
- Strip trailing empty lines
- Remove a trailing `---` only when it is the synthetic DeepWiki page separator at the page boundary before the next page body begins with `#`

Run the bundled splitter from the chosen skill directory:

```bash
node <skill-dir>/scripts/split-pages.js raw/wiki-contents.md references
```

The script writes the reference files plus `references/_slug-map.json`. **If the script is missing or fails, stop and report the failure — do not reimplement it inline.** Re-deriving slug rules across runs breaks determinism and silently corrupts structure links.

After splitting:

- verify that at least one reference file was created
- verify that `references/_slug-map.json` exists and is non-empty
- stop and fix the split step before continuing if either check fails

### 4. Build the hierarchical structure list from the same mapping

Produce a hierarchical Markdown list linking each structure item to the correct reference file.

Required invariants:

- Reuse the exact slug mapping created during page splitting; never recompute links independently
- Require `references/_slug-map.json`; if it is missing, stop and rerun step 3
- Validate that the flattened structure title sequence matches the persisted slug mapping exactly
- If the structure and slug map disagree, rerun step 3 and resolve the mismatch before continuing
- Keep links one level deep and point only to `references/*.md`
- Preserve the hierarchy expressed by the wiki structure output
- Capture the resulting Markdown list for the final `SKILL.md`

Run the bundled structure builder and capture its stdout:

```bash
node <skill-dir>/scripts/build-structure.js raw/wiki-structure.txt references
```

**If the script is missing or fails, stop and report the failure — do not reimplement it inline.** Recomputing slugs in this step (instead of consuming `_slug-map.json`) is the most common cause of broken structure links.

Before continuing, verify that every generated link target exists on disk.

### 5. Select representative references

Choose 1 to 3 reference files that best represent what an LLM needs in order to understand the project.

Selection (deterministic):

1. Always include the first page.
2. Add the first page whose title matches `/architecture|overview|concepts|design|internals/i`.
3. Add the first page whose title matches `/api|schema|model|data|reference/i`.
4. Cap the selection at 3 files.

Validation (after selection):

- Confirm each selected path resolves to a real file in `references/`.
- If a selected file is missing, replace it with the next match in the same category. If no candidate remains in that category, drop the slot rather than substituting from another category.

Before proceeding, confirm that all selected reference paths resolve to real files.

### 6. Generate `SKILL.md`

Read the selected reference files and the generated structure list, then write the final `SKILL.md` into the chosen skill directory.

Required frontmatter:

```yaml
---
name: <skill-name>
description: <what the skill does>. Use when <trigger scenarios>.
---
```

Frontmatter rules:

- **name:** lowercase, hyphens only, max 64 characters
- Use repo name alone when it is descriptive
- Add owner prefix only for generic or ambiguous repo names
- **description:** third person, specific, and includes both WHAT the skill covers and WHEN to use it
- Keep the description under 1024 characters

Body rules:

- Keep the body under 500 lines
- Include core procedural knowledge in the body: purpose, tech stack, key patterns, and how to use the references
- Put the linked hierarchical reference list at the end
- Keep all links one level deep and pointing only to `references/*.md`
- If there are many references, group them by domain such as architecture, data, or UI
- Add a brief note reminding the user that DeepWiki MCP can answer follow-up repo questions beyond the generated files

Reference-file enhancement:

- For any reference file over about 100 lines, add a table of contents immediately after the H1 heading

### 7. Final validation before finishing

Before you consider the conversion complete, verify all of the following:

- `raw/wiki-structure.txt` exists and is non-empty
- `raw/wiki-contents.md` exists and is non-empty
- at least one `references/*.md` file exists
- `references/_slug-map.json` exists and is non-empty
- every link in the generated hierarchy points to an existing `references/*.md` file
- the final `SKILL.md` contains valid YAML frontmatter
- the final `SKILL.md` body stays under 500 lines
- the final `SKILL.md` includes the hierarchical reference list

If any validation check fails, stop and fix it before returning success.

## Format notes

These rules apply during page splitting:

- `# Page: [Page Title]` marks the start of each page in the wiki-contents output
- The first page begins at line 1 with no leading delimiter, so handle segment 0 separately
- `---` inside page content is valid markdown and must not be treated as a delimiter by default
- Treat a trailing `---` as the synthetic DeepWiki page separator only when the current page ends with `---` and the immediately following content begins with a `#` heading for the next page body

### Example

Input (`raw/wiki-contents.md`):

```
# Page: Overview
# Overview
Intro paragraph.

---

# Page: Architecture
# Architecture
Layered system…
```

Output:

- `references/overview.md` — body starts with `# Overview`. The trailing `---` is stripped because it preceded a `#` heading (synthetic page boundary).
- `references/architecture.md` — body starts with `# Architecture`.
- `references/_slug-map.json` — `{ "entries": [ { "title": "Overview", "filename": "overview.md", ... }, { "title": "Architecture", "filename": "architecture.md", ... } ] }`

## Script locations

Helper scripts live in the same skill directory as this `SKILL.md`. They are required, not optional — if a script is missing, stop and ask the user to restore it (e.g. from a fresh checkout) rather than reimplementing inline:

- `scripts/split-pages.js` — splits wiki contents into reference files and writes `references/_slug-map.json`
- `scripts/build-structure.js` — reads `references/_slug-map.json` and produces the hierarchical markdown list
- `scripts/reference.md` — load on demand for the page-delimiter, structure-list, and slug rules

## When the workflow stops at a validation gate

Append a one-line note to `docs/learnings.md` recording the failure mode and the repo. This builds a lightweight retrospective so future runs can anticipate edge cases (e.g. "vercel/ai — slug collision on three `Reference` pages", "supabase/supabase — `# Page:` markers missing from contents output").
