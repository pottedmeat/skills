#!/usr/bin/env node
/**
 * Convert DeepWiki structure to a Markdown list with links to reference files.
 *
 * Usage: node build-structure.js <structure-file> [references-dir]
 *
 * Reads structure (from read_wiki_structure), parses hierarchy, and outputs
 * markdown list linking each item to references/<filename>.md.
 * Requires references/_slug-map.json so duplicate titles stay aligned safely.
 */

const fs = require('fs');
const path = require('path');

const structurePath = process.argv[2];
const refDir = process.argv[3] || 'references';

if (!structurePath) {
  console.error('Usage: node build-structure.js <structure-file> [references-dir]');
  process.exit(1);
}

const structure = fs.readFileSync(structurePath, 'utf8');

function loadSlugEntries(refDir) {
  const slugMapPath = path.join(refDir, '_slug-map.json');

  if (!fs.existsSync(slugMapPath)) {
    throw new Error(
      `Missing ${slugMapPath}. Run split-pages.js first so structure links reuse the persisted mapping.`
    );
  }

  const parsed = JSON.parse(fs.readFileSync(slugMapPath, 'utf8'));
  if (!Array.isArray(parsed.entries)) {
    throw new Error(`Invalid slug map at ${slugMapPath}: expected an "entries" array`);
  }

  return parsed.entries;
}

function getStructureItems(text) {
  const items = [];

  for (const line of text.split('\n')) {
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
    if (!bulletMatch) {
      continue;
    }

    const indent = bulletMatch[1];
    const rest = bulletMatch[2].trim();

    // Extract title: "1 Overview" or "2.1 Application Entry Point and Routing"
    const titleMatch = rest.match(/^(?:\d+(?:\.\d+)*\.?\s+)?(.+)$/);
    const title = titleMatch ? titleMatch[1].trim() : rest;

    if (!title) {
      continue;
    }

    items.push({ indent, title });
  }

  return items;
}

function validateStructureAlignment(structureItems, slugEntries) {
  if (slugEntries.length !== structureItems.length) {
    throw new Error(
      `Entry count mismatch: structure has ${structureItems.length}, slug map has ${slugEntries.length}`
    );
  }

  for (let index = 0; index < structureItems.length; index++) {
    const structureTitle = structureItems[index].title;
    const slugEntry = slugEntries[index];

    if (!slugEntry || !slugEntry.filename) {
      throw new Error(`Missing slug-map entry at position ${index + 1}`);
    }

    if (slugEntry.title !== structureTitle) {
      throw new Error(
        `Title sequence mismatch at position ${index + 1}: structure has "${structureTitle}", slug map has "${slugEntry.title}"`
      );
    }
  }
}

function buildStructureMarkdown(text) {
  const structureItems = getStructureItems(text);
  const out = [];
  const slugEntries = loadSlugEntries(refDir);

  validateStructureAlignment(structureItems, slugEntries);

  for (let index = 0; index < structureItems.length; index++) {
    const item = structureItems[index];
    const filename = slugEntries[index].filename;
    const link = `[${item.title}](references/${filename})`;
    out.push(`${item.indent}- ${link}`);
  }

  return out.join('\n');
}

const md = buildStructureMarkdown(structure);
process.stdout.write(md);
