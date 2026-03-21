---
name: deepwiki-to-skill
description: Converts DeepWiki responses from any GitHub repo into a local Cursor skill. Fetches wiki structure and contents via DeepWiki MCP, splits pages into reference files, builds a hierarchical index, and generates a SKILL.md. Use when the user wants to create a skill from a repo's DeepWiki documentation or when converting DeepWiki output to a reusable skill.
---

# DeepWiki to Skill

Converts DeepWiki wiki-structure and wiki-content MCP output into a Cursor skill with progressive disclosure: a concise SKILL.md plus reference files loaded on demand.

## Prerequisites

- DeepWiki MCP enabled with tools for reading wiki structure and full wiki content
- User provides repo (e.g. `owner/repo`)
- Ask the user whether the generated skill should be a project skill (`.cursor/skills/<skill-dir>/`) or a personal skill (`~/.cursor/skills/<skill-dir>/`)

## Workflow

### 1. Verify DeepWiki access and choose destination

Before doing any conversion work:

- Confirm DeepWiki MCP is available
- Discover the available DeepWiki tools and inspect their schemas before calling them
- Verify there is a tool for reading wiki structure and another for reading full wiki contents
- Tool names may vary by environment; use the available equivalents
- For example, some environments expose `read_wiki_structure` and `read_wiki_contents`
- If the needed tools are missing, install, authenticate, or configure DeepWiki MCP if the environment allows it
- If the environment does not allow that, stop and ask the user to enable it
- Ask whether the output should go in `.cursor/skills/<skill-dir>/` or `~/.cursor/skills/<skill-dir>/`

### 2. Fetch and store raw data

Call the DeepWiki MCP tools that read:

- the wiki structure tool (for example `read_wiki_structure`) with `repoName: "owner/repo"`
- the full wiki contents tool (for example `read_wiki_contents`) with `repoName: "owner/repo"`

Create the output directory at the user-selected destination:

```
<chosen-skill-root>/<skill-dir>/
├── raw/
│   ├── wiki-structure.txt
│   └── wiki-contents.md
```

Directory naming rule:

- **Prefer repo name alone** when it's descriptive (e.g. `react-native-gifted-charts`, `next.js`, `prisma`)
- **Use `<owner>-<repo>`** only when the repo name is generic or ambiguous (e.g. `vercel-ai` for `vercel/ai`, `facebook-react` for `facebook/react`)
- The owner is arbitrary metadata; include it only when it adds disambiguation value

Save the structure output to `raw/wiki-structure.txt` and the contents from the MCP response to `raw/wiki-contents.md`.

### 3. Split pages into references with stable unique filenames

Split content by `# Page: [Title]` markers into `references/*.md`.

Important invariants:

- Pages are delimited by `\n# Page: `; the first page starts at line 1 with no leading delimiter
- In DeepWiki content, each page body typically starts with its own H1, such as `# Overview`
- Create one reference file per page
- Use deterministic readable slugs
- If multiple titles collapse to the same slug, disambiguate them predictably, such as `slug.md`, `slug-2.md`, `slug-3.md`
- Persist the title-to-filename mapping so later steps reuse the exact same links
- Preserve leading indentation and other indentation-sensitive markdown
- Strip trailing empty lines
- Remove a trailing `---` only when it is the synthetic DeepWiki page separator, which appears at a page boundary before the next page body begins with `#`

The provided helper script writes reference files plus `references/_slug-map.json`, but equivalent logic is also fine.

### 4. Build the hierarchical structure list from the same mapping

Produce a hierarchical Markdown list linking each structure item to the correct reference file.

Important invariants:

- Reuse the same slug mapping created during page splitting; do not recompute links independently
- Require `references/_slug-map.json`; if it is missing, stop and rerun page splitting instead of inventing fallback links
- Validate that the flattened structure title sequence matches the persisted slug mapping exactly; if it does not, stop and fix the mismatch
- Keep links one level deep and point only to `references/*.md`
- Preserve the hierarchy expressed by `read_wiki_structure`
- Capture the resulting Markdown list for the final `SKILL.md`

The provided helper script can do this if `references/_slug-map.json` exists, but equivalent logic is also fine.

### 5. Select representative references

Choose 1–3 reference files that best represent what an LLM needs to understand the project. Typical picks:

- First page (often overview-like, but not always — "Overview" is coincidental)
- Architecture or core concepts
- Data layer, API, or domain model

### 6. Generate SKILL.md

Read the selected references and the structure string. Write `SKILL.md` into the user-selected skill directory.

**Frontmatter (required):** Every generated SKILL.md must start with YAML frontmatter:

```yaml
---
name: <skill-name>   # lowercase, hyphens only, max 64 chars
description: <what the skill does>. Use when <trigger scenarios>.
---
```

- **name:** Use repo name alone when descriptive (e.g. `react-native-gifted-charts`, `prisma`). Add owner prefix only for generic names (e.g. `vercel-ai` for `vercel/ai`). Lowercase letters, numbers, hyphens only.
- **description:** Third person, specific. Include WHAT (capabilities) and WHEN (trigger terms). Max 1024 chars. Example: "Documents the Next.js framework: routing, data fetching, rendering. Use when building Next.js apps, debugging routing, or when the user asks about Next.js."

**Body:**
- **Keep under 500 lines** (progressive disclosure)
- **Core procedural knowledge** in the body: purpose, tech stack, key patterns
- **Reference list** at the end: paste the structure output as a hierarchical list of links
- **One level deep:** all links point to `references/*.md`; no nested reference chains
- **Domain grouping:** if references are numerous, group by domain (e.g. architecture, data, UI)
- **Follow-up questions** include a short reminder that the DeepWiki MCP can be used to answer additional follow-up questions about the repo when needed

For reference files over ~100 lines, add a table of contents at the top when creating them (optional enhancement).

## Format notes

- `# Page: [Page Title]` marks the start of each page in the content
- `---` in the content is valid markdown, not automatically a page delimiter
- Treat a trailing `---` as synthetic only when it matches the DeepWiki page boundary pattern: the current page ends with `---` and the next page body begins with `#`
- The first page has no `---` before it; handle segment 0 specially in split logic

## Script locations

Optional helper scripts live in this skill directory (the same directory as this `SKILL.md`):

- `scripts/split-pages.js` — split content into reference files
- `scripts/build-structure.js` — build hierarchical markdown list with links using `references/_slug-map.json`

Use them if helpful, but the agent may also implement equivalent logic directly.
