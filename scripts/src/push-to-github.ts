/**
 * Wysyla zmiany na GitHub w JEDNYM commicie (Git Tree API).
 * Domyslnie: tylko app/page.tsx (Game.tsx).
 * Z flagą --images: takze wszystkie foldery z obrazkami.
 *
 * Uzycie:
 *   pnpm --filter @workspace/scripts run push-to-github
 *   pnpm --filter @workspace/scripts run push-to-github -- --images
 */
import { readFile, readdir } from "fs/promises";
import { resolve } from "path";
import { existsSync } from "fs";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "lee14original-web";
const REPO = "Plonopolis";
const BRANCH = "main";
const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const WITH_IMAGES = process.argv.includes("--images");

// Foldery z obrazkami do synchronizacji (lokalny -> GitHub)
const IMAGE_FOLDERS: { local: string; github: string }[] = [
  { local: "artifacts/plonopolis/public/uprawy",    github: "public/uprawy" },
  { local: "artifacts/plonopolis/public/avatary",   github: "public/avatary" },
  { local: "artifacts/plonopolis/public/owoce",     github: "public/owoce" },
  { local: "artifacts/plonopolis/public/przedmioty",github: "public/przedmioty" },
  { local: "artifacts/plonopolis/public/ul",        github: "public/ul" },
  { local: "artifacts/plonopolis/public/ekwipunek", github: "public/ekwipunek" },
];

if (!GITHUB_TOKEN) { console.error("Brak GITHUB_TOKEN."); process.exit(1); }

async function gh(method: string, path: string, body?: unknown) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error(`GitHub ${method} ${path} => ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

async function createBlob(content: Buffer): Promise<string> {
  const data = await gh("POST", `/repos/${OWNER}/${REPO}/git/blobs`, {
    content: content.toString("base64"),
    encoding: "base64",
  });
  return data.sha as string;
}

async function main() {
  const filesToPush: { githubPath: string; localPath: string }[] = [];

  // Zawsze: Game.tsx → app/page.tsx
  filesToPush.push({
    githubPath: "app/page.tsx",
    localPath: resolve(ROOT, "artifacts/plonopolis/src/Game.tsx"),
  });

  // Opcjonalnie: wszystkie foldery z obrazkami
  if (WITH_IMAGES) {
    for (const folder of IMAGE_FOLDERS) {
      const dir = resolve(ROOT, folder.local);
      if (!existsSync(dir)) continue;
      const files = await readdir(dir);
      for (const f of files) {
        filesToPush.push({ githubPath: `${folder.github}/${f}`, localPath: resolve(dir, f) });
      }
      console.log(`  ${folder.github}/: ${files.length} plikow`);
    }
  }

  console.log(`\nWysylam ${filesToPush.length} plik(ow) → 1 commit...`);

  // Pobierz HEAD
  const refData = await gh("GET", `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`);
  const headSha = (refData.object as Record<string, string>).sha;
  const commitData = await gh("GET", `/repos/${OWNER}/${REPO}/git/commits/${headSha}`);
  const baseTreeSha = (commitData.tree as Record<string, string>).sha;

  // Tworz blob dla kazdego pliku (rownolegly batch po 10)
  const BATCH = 10;
  const treeEntries: unknown[] = [];
  for (let i = 0; i < filesToPush.length; i += BATCH) {
    const batch = filesToPush.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async ({ githubPath, localPath }) => {
      const buf = await readFile(localPath);
      const sha = await createBlob(buf);
      return { path: githubPath, mode: "100644", type: "blob", sha };
    }));
    treeEntries.push(...results);
    if (filesToPush.length > 10) console.log(`  ${Math.min(i + BATCH, filesToPush.length)}/${filesToPush.length} blobów`);
  }

  // Tree → commit → ref
  const treeData = await gh("POST", `/repos/${OWNER}/${REPO}/git/trees`, { base_tree: baseTreeSha, tree: treeEntries });
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const newCommit = await gh("POST", `/repos/${OWNER}/${REPO}/git/commits`, {
    message: `sync z Replita [${now}]`,
    tree: treeData.sha as string,
    parents: [headSha],
  });
  await gh("PATCH", `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, { sha: newCommit.sha as string });

  console.log(`\nGotowe! Commit: ${(newCommit.sha as string).slice(0, 7)}`);
  console.log(`Railway zbuduje nowa wersje w ciagu ~3 minut.`);
}

main().catch(err => { console.error("Blad:", err instanceof Error ? err.message : err); process.exit(1); });
