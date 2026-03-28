---
name: deepwiki-to-skill
description: Converts DeepWiki documentation from a GitHub repository into a reusable local Cursor or Agent Zero skill. Verifies DeepWiki tool access, captures raw wiki structure and contents, splits pages into stable reference files, rebuilds a linked hierarchy, and generates a concise SKILL.md with progressive disclosure. Use when the user wants to turn DeepWiki repo documentation into a local skill, asks to document a GitHub repo as a skill, or wants to reuse DeepWiki output as structured skill files. Do not use for repos without DeepWiki coverage or for generating skills directly from source code.
---

# DeepWiki to Skill

Convert DeepWiki wiki structure and wiki content output into a local Cursor or Agent Zero skill with progressive disclosure: a concise `SKILL.md` plus `references/*.md` files loaded on demand.

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

- Confirm that DeepWiki MCP is available
- Discover the available DeepWiki tools and inspect their schemas before calling them
- Verify there is one tool for reading wiki structure and another for reading full wiki contents
- Tool names may vary by environment; use the available equivalents
- Some environments expose tools such as `read_wiki_structure` and `read_wiki_contents`
- If the needed tools are missing, install, authenticate, or configure DeepWiki MCP only if the environment allows it
- If the environment does not allow that, stop and ask the user to enable DeepWiki MCP
- Ask whether the output should go in `.cursor/skills/<skill-dir>/` or `~/.cursor/skills/<skill-dir>/`
- Resolve the final skill directory name before creating files

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

Prefer `scripts/split-pages.js` if it exists in this skill directory. It should write the reference files plus `references/_slug-map.json`. If the script is unavailable or fails, implement equivalent logic inline.

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

Prefer `scripts/build-structure.js` if it exists in this skill directory. If the script is unavailable or fails, implement equivalent logic inline.

Before continuing, verify that every generated link target exists on disk.

### 5. Select representative references

Choose 1 to 3 reference files that best represent what an LLM needs in order to understand the project.

Use this deterministic selection order:

1. **Always include the first page**
2. **Add one architecture or core-concepts page** if a title contains terms such as `architecture`, `overview`, `concepts`, `design`, or `internals`
3. **Add one data, API, or domain page** if a title contains terms such as `api`, `schema`, `model`, `data`, or `reference`
4. **Stop at 3 files maximum**
5. **Verify each selected file exists** in `references/`
6. If a selected file is missing, replace it with the next best matching candidate

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

## Script locations

Helper scripts live in the same skill directory as this `SKILL.md`. Prefer them over inline logic and fall back to inline logic only if they are unavailable or fail:

- `scripts/split-pages.js` — splits wiki contents into reference files and writes `references/_slug-map.json`
- `scripts/build-structure.js` — reads `references/_slug-map.json` and produces the hierarchical markdown list
