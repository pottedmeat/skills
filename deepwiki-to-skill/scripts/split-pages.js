#!/usr/bin/env node
/**
 * Split DeepWiki content by "# Page: [Title]" markers into reference files.
 *
 * Usage: node split-pages.js <content-file> <output-dir>
 *
 * - Splits on \n# Page: (first page has no leading delimiter)
 * - Writes each page to a deterministic unique slug in references/
 * - Persists the title-to-filename mapping to references/_slug-map.json
 * - Removes only the synthetic DeepWiki page separator when detected
 */

const fs = require('fs');
const path = require('path');

const contentPath = process.argv[2];
const outDir = process.argv[3] || 'references';

if (!contentPath) {
  console.error('Usage: node split-pages.js <content-file> <output-dir>');
  process.exit(1);
}

const content = fs.readFileSync(contentPath, 'utf8');

function toSlug(title) {
  const slug = title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'page';
}

function getBodyStart(segment) {
  const firstNewline = segment.indexOf('\n');
  if (firstNewline < 0) {
    return '';
  }

  return segment.substring(firstNewline + 1);
}

function isSyntheticPageSeparator(content, nextSegment) {
  if (!nextSegment) {
    return false;
  }

  if (!/\n---\s*$/.test(content)) {
    return false;
  }

  return /^\s*#\s+/.test(getBodyStart(nextSegment));
}

function stripTrailing(content, nextSegment) {
  let cleaned = content.replace(/\s+$/g, '');

  if (isSyntheticPageSeparator(cleaned, nextSegment)) {
    cleaned = cleaned.replace(/\n---\s*$/g, '');
  }

  return cleaned.replace(/\s+$/g, '');
}

// Split on newline followed by "# Page: " (first page has no leading \n)
const segments = content.split(/\n# Page: /);

fs.mkdirSync(outDir, { recursive: true });

const slugCounts = new Map();
const slugEntries = [];

for (let i = 0; i < segments.length; i++) {
  const seg = segments[i];
  if (!seg.trim()) continue;

  let title;
  const firstNewline = seg.indexOf('\n');

  if (i === 0) {
    // Segment 0: "# Page: Overview\n..."
    const match = seg.match(/^# Page: (.+?)(?:\n|$)/);
    title = match ? match[1].trim() : null;
  } else {
    // Segment 1+: "Architecture\n..."
    title =
      firstNewline >= 0
        ? seg.substring(0, firstNewline).trim()
        : seg.trim();
  }

  if (!title) continue;

  const body =
    firstNewline >= 0 ? seg.substring(firstNewline + 1) : '';
  const cleaned = stripTrailing(body, segments[i + 1]);

  const baseSlug = toSlug(title);
  const collisionCount = (slugCounts.get(baseSlug) || 0) + 1;
  slugCounts.set(baseSlug, collisionCount);

  const slug =
    collisionCount === 1 ? baseSlug : `${baseSlug}-${collisionCount}`;
  const filepath = path.join(outDir, slug + '.md');
  fs.writeFileSync(filepath, cleaned, 'utf8');
  slugEntries.push({
    index: slugEntries.length,
    title,
    baseSlug,
    slug,
    filename: slug + '.md',
  });
  console.log(slug + '.md');
}

const slugMapPath = path.join(outDir, '_slug-map.json');
fs.writeFileSync(
  slugMapPath,
  JSON.stringify({ entries: slugEntries }, null, 2) + '\n',
  'utf8'
);
