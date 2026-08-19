#!/usr/bin/env node
/**
 * Converts PNG files in the four image directories to WebP.
 * - Max longer edge: 512px
 * - Quality: 82
 * - Alpha preserved
 * - Idempotent: skips files that already have a .webp counterpart
 * - Deletes original PNG after successful conversion
 */
import sharp from "sharp";
import { readdir, unlink, stat } from "fs/promises";
import { join, basename, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC = join(__dirname, "..", "public");

const DIRS = [
  join(PUBLIC, "uprawy"),
  join(PUBLIC, "zwierzeta"),
  join(PUBLIC, "avatary"),
  join(PUBLIC, "ekwipunek"),
  join(PUBLIC, "przedmioty"),
  join(PUBLIC, "klienci"),
  join(PUBLIC, "owoce"),
];

async function findPngs(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    console.warn(`  Skipping missing dir: ${dir}`);
    return results;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      results.push(...(await findPngs(full)));
    } else if (e.isFile() && extname(e.name).toLowerCase() === ".png") {
      results.push(full);
    }
  }
  return results;
}

let converted = 0, skipped = 0, failed = 0;

for (const dir of DIRS) {
  const pngs = await findPngs(dir);
  console.log(`\n${dir}: ${pngs.length} PNG(s) found`);
  for (const pngPath of pngs) {
    const webpPath = pngPath.slice(0, -4) + ".webp";
    // Idempotency: if webp already exists and png is gone — skip
    try {
      await stat(webpPath);
      // webp exists — still need to delete PNG if present
      await unlink(pngPath);
      console.log(`  [already done, cleaned PNG] ${basename(pngPath)}`);
      skipped++;
      continue;
    } catch {
      // webp doesn't exist yet — convert
    }
    try {
      const img = sharp(pngPath);
      const meta = await img.metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      const needsResize = w > 512 || h > 512;
      let pipeline = img;
      if (needsResize) {
        pipeline = img.resize({
          width: 512,
          height: 512,
          fit: "inside",
          withoutEnlargement: true,
        });
      }
      await pipeline
        .webp({ quality: 82, alphaQuality: 100, lossless: false })
        .toFile(webpPath);
      await unlink(pngPath);
      console.log(`  [ok] ${basename(pngPath)} → .webp${needsResize ? ` (resized from ${w}×${h})` : " (no resize)"}`);
      converted++;
    } catch (err) {
      console.error(`  [FAILED] ${basename(pngPath)}: ${err.message}`);
      failed++;
    }
  }
}

console.log(`\n✅ Done: ${converted} converted, ${skipped} already done, ${failed} failed`);
if (failed > 0) process.exit(1);
