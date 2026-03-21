# DeepWiki Format Reference

## Content format

- Each page starts with `# Page: [Page Title]` on its own line
- Pages are separated by `\n# Page: ` — the first page has no leading delimiter
- Each page body typically begins with its own H1, such as `# Overview`
- `---` in the body is valid markdown (horizontal rule), not automatically a page delimiter
- Split logic: `content.split(/\n# Page: /)` then handle segment 0 specially
- Preserve leading indentation in page bodies; some pages may begin with indented markdown or code blocks
- Remove a trailing `---` only when it is the synthetic DeepWiki separator at a page boundary, where the next page body begins with `#`
- Reference filenames must stay deterministic across the workflow
- If multiple page titles collapse to the same slug, disambiguate predictably, such as `slug.md`, `slug-2.md`, `slug-3.md`
- Persist the mapping in `references/_slug-map.json` so structure links reuse the exact filenames

## Structure format (read_wiki_structure)

- Bullet list with optional numbering: `- 1 Overview`, `- 2.1 Application Entry Point and Routing`
- Indentation indicates hierarchy: 2 spaces = child of previous item
- Title extraction: strip leading `N` or `N.N` pattern, use remainder as title
- Structure-link generation should reuse the persisted slug mapping instead of recomputing slugs independently
- Require `references/_slug-map.json`; if it is missing, stop and rerun the page split first
- Validate the flattened structure title sequence against `references/_slug-map.json`; if it does not match exactly, stop instead of generating guessed links

## Slug rules

- Lowercase
- Spaces → hyphens
- Remove non-alphanumeric except hyphens
- Collapse repeated hyphens and trim leading/trailing hyphens
- If the result is empty, use `page`
