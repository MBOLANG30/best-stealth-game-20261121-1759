// main.ts — the hand-in for Night Shift at the Archive.
//
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from
// vendor/makefun-game.ts. Outside the grader, MAKEFUN_OUTPUT_DIR stands in
// for /output.
//
// The output directory is a mount point in the grader: this program deletes
// only the CONTENTS of the output directory, never the directory itself,
// and it clears stale files from a previous run before copying.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outDir = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : '/output';

function emptyContentsOnly(dir: string): void {
  // Remove every entry inside dir, one by one. The directory itself is
  // never removed: the grader mounts it, and removing a mount point fails.
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    return;
  }
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function main(): void {
  const gameSrc = join(repoRoot, 'game');
  const shotsSrc = join(repoRoot, 'screenshots');
  if (!existsSync(gameSrc)) throw new Error(`main.ts: no game/ directory at ${gameSrc}`);
  if (!existsSync(shotsSrc)) throw new Error(`main.ts: no screenshots/ directory at ${shotsSrc}`);

  emptyContentsOnly(outDir);
  cpSync(gameSrc, join(outDir, 'game'), { recursive: true });
  cpSync(shotsSrc, join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  // Verify the hand-in before reporting success: the page, the dossier and
  // the screenshots must all be there, and the dossier must parse back.
  const indexHtml = join(outDir, 'game', 'index.html');
  const dossierPath = join(outDir, 'dossier.json');
  if (!existsSync(indexHtml)) throw new Error(`main.ts: ${indexHtml} missing after copy`);
  if (!existsSync(dossierPath)) throw new Error(`main.ts: ${dossierPath} missing after write`);
  const parsed = JSON.parse(new TextDecoder().decode(readFileSync(dossierPath)));
  if (parsed.schema !== 'makefun/dossier/v1') throw new Error('main.ts: dossier.json has the wrong schema');
  const shotCount = readdirSync(join(outDir, 'screenshots')).filter((n) => !n.startsWith('.')).length;
  console.log(`main.ts: wrote ${outDir} (dossier.json ${dossier.length} bytes, ${parsed.images.length} screenshots, game/index.html present)`);
  if (shotCount !== parsed.images.length) throw new Error(`main.ts: ${shotCount} screenshots on disk but ${parsed.images.length} in the dossier`);
}

main();
