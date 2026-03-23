#!/usr/bin/env node
/**
 * Patches @expo/cli to auto-proceed anonymously instead of blocking
 * the terminal with an interactive login prompt in the Replit environment.
 * Re-run automatically via the `postinstall` script in package.json.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findActionsFile() {
  try {
    const result = execSync(
      'find /home/runner/workspace/node_modules/.pnpm -name "actions.js" -path "*@expo/cli*user*" 2>/dev/null',
      { encoding: 'utf8', timeout: 10000 }
    ).trim();
    return result.split('\n').filter(Boolean)[0];
  } catch {
    return null;
  }
}

const filePath = findActionsFile();
if (!filePath) {
  console.log('[patch-expo-cli] Could not find @expo/cli actions.js — skipping patch.');
  process.exit(0);
}

const content = fs.readFileSync(filePath, 'utf8');
if (content.includes('auto-proceed anonymously')) {
  console.log('[patch-expo-cli] Already patched — nothing to do.');
  process.exit(0);
}

const patched = content.replace(
  /const choices = \[\s*\{[\s\S]*?title: 'Proceed anonymously',[\s\S]*?\}\s*\];[\s\S]*?return null;\s*\}/,
  `// Patched: auto-proceed anonymously in dev to avoid blocking terminal prompt
    return null;
}`
);

if (patched === content) {
  console.log('[patch-expo-cli] Pattern not matched — Expo CLI may have updated. Patch not applied.');
  process.exit(0);
}

fs.writeFileSync(filePath, patched);
console.log(`[patch-expo-cli] Patched successfully: ${filePath}`);
