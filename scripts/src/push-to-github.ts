/**
 * Wysyla zmiany na GitHub w JEDNYM commicie (Git Tree API).
 *
 * Flagi:
 *   (brak)      — app/page.tsx (Game.tsx) + app/game/** (wszystkie moduły)
 *   --images    — tylko nowe/zmienione foldery obrazkow (max ~50 plikow)
 *   --all       — wszystkie pliki (uwaga: limit GitHub ~200 blobów na tree)
 *   --sql       — pliki attached_assets/*.sql → sql/ w repo GitHub
 *
 * Uzycie:
 *   pnpm --filter @workspace/scripts run push-to-github
 *   pnpm --filter @workspace/scripts run push-to-github -- --images
 *   pnpm --filter @workspace/scripts run push-to-github -- --sql
 */
import { readFile, readdir, stat } from "fs/promises";
import { resolve, join } from "path";
import { existsSync } from "fs";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "lee14original-web";
const REPO = "Plonopolis";
const BRANCH = "main";
const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const WITH_IMAGES = process.argv.includes("--images");
const WITH_ALL    = process.argv.includes("--all");
const WITH_SQL    = process.argv.includes("--sql");
const MSG_IDX     = process.argv.indexOf("--message");
const CUSTOM_MSG  = MSG_IDX !== -1 ? process.argv[MSG_IDX + 1] : undefined;

// Foldery "nowe/rzadko zmieniane" — uzyj --images aby je wyslac
const NEW_IMAGE_FOLDERS: { local: string; github: string }[] = [
  { local: "artifacts/plonopolis/public/mapy",      github: "public/mapy" },
  { local: "artifacts/plonopolis/public/ui",         github: "public/ui" },
  { local: "artifacts/plonopolis/public/owoce",      github: "public/owoce" },
  { local: "artifacts/plonopolis/public/przedmioty", github: "public/przedmioty" },
  { local: "artifacts/plonopolis/public/ekwipunek",  github: "public/ekwipunek" },
  { local: "artifacts/plonopolis/public/zwierzeta",  github: "public/zwierzeta" },
  { local: "artifacts/plonopolis/public/przeszkody",  github: "public/przeszkody" },
  { local: "artifacts/plonopolis/public/klienci",     github: "public/klienci" },
];

// Foldery duze — tylko z --all
const ALL_IMAGE_FOLDERS: { local: string; github: string }[] = [
  { local: "artifacts/plonopolis/public/uprawy",  github: "public/uprawy" },
  { local: "artifacts/plonopolis/public/avatary", github: "public/avatary" },
  { local: "artifacts/plonopolis/public/ul",      github: "public/ul" },
  ...NEW_IMAGE_FOLDERS,
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

async function pushCommit(files: { githubPath: string; localPath: string }[], baseRef: string, msg: string) {
  const commitData = await gh("GET", `/repos/${OWNER}/${REPO}/git/commits/${baseRef}`);
  const baseTreeSha = (commitData.tree as Record<string, string>).sha;

  const BATCH = 10;
  const treeEntries: unknown[] = [];
  for (let i = 0; i < files.length; i += BATCH) {
    const batch = files.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async ({ githubPath, localPath }) => {
      const buf = await readFile(localPath);
      const sha = await createBlob(buf);
      return { path: githubPath, mode: "100644", type: "blob", sha };
    }));
    treeEntries.push(...results);
    if (files.length > 10) process.stdout.write(`  ${Math.min(i + BATCH, files.length)}/${files.length} blobów\r`);
  }
  if (files.length > 10) console.log();

  const treeData = await gh("POST", `/repos/${OWNER}/${REPO}/git/trees`, { base_tree: baseTreeSha, tree: treeEntries });
  const newCommit = await gh("POST", `/repos/${OWNER}/${REPO}/git/commits`, {
    message: msg,
    tree: treeData.sha as string,
    parents: [baseRef],
  });
  return newCommit.sha as string;
}

/** Rekurencyjnie zbiera wszystkie pliki z katalogu lokalnego,
 *  mapując je na sciezki GitHub (localBase → githubBase). */
async function collectDirFiles(
  localBase: string,
  githubBase: string,
): Promise<{ githubPath: string; localPath: string }[]> {
  const entries = await readdir(localBase);
  const result: { githubPath: string; localPath: string }[] = [];
  for (const entry of entries) {
    const localFull = join(localBase, entry);
    const githubFull = `${githubBase}/${entry}`;
    const s = await stat(localFull);
    if (s.isDirectory()) {
      const sub = await collectDirFiles(localFull, githubFull);
      result.push(...sub);
    } else {
      result.push({ githubPath: githubFull, localPath: localFull });
    }
  }
  return result;
}

async function main() {
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");

  // Pobierz aktualny HEAD
  const refData = await gh("GET", `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`);
  let headSha = (refData.object as Record<string, string>).sha;

  const folders = WITH_ALL ? ALL_IMAGE_FOLDERS : (WITH_IMAGES ? NEW_IMAGE_FOLDERS : []);

  if (folders.length > 0) {
    // Grupuj po 50 plikow max na commit (limit GitHub tree API)
    const allImgFiles: { githubPath: string; localPath: string }[] = [];
    for (const folder of folders) {
      const dir = resolve(ROOT, folder.local);
      if (!existsSync(dir)) continue;
      const files = await readdir(dir);
      for (const f of files) {
        allImgFiles.push({ githubPath: `${folder.github}/${f}`, localPath: resolve(dir, f) });
      }
    }

    const CHUNK = 50;
    let chunkNum = 0;
    for (let i = 0; i < allImgFiles.length; i += CHUNK) {
      chunkNum++;
      const chunk = allImgFiles.slice(i, i + CHUNK);
      console.log(`Obrazki chunk ${chunkNum}: ${chunk.length} plikow...`);
      headSha = await pushCommit(chunk, headSha, `sync obrazki [${now}] cz.${chunkNum}`);
      console.log(`  commit: ${headSha.slice(0, 7)}`);
    }
  }

  // Tryb --sql: attached_assets/*.sql → sql/ w repo GitHub
  if (WITH_SQL) {
    const sqlDir = resolve(ROOT, "attached_assets");
    if (existsSync(sqlDir)) {
      const allFiles = await readdir(sqlDir);
      const sqlFiles = allFiles.filter(f => f.endsWith(".sql"));
      if (sqlFiles.length > 0) {
        const sqlEntries = sqlFiles.map(f => ({
          githubPath: `sql/${f}`,
          localPath: resolve(sqlDir, f),
        }));
        console.log(`Wysylam ${sqlFiles.length} plikow SQL → sql/...`);
        headSha = await pushCommit(sqlEntries, headSha, `sync sql [${now}]`);
        console.log(`  commit: ${headSha.slice(0, 7)}`);
        for (const f of sqlFiles) console.log(`  sql/${f}`);
      } else {
        console.log("Brak plikow .sql w attached_assets/");
      }
    }
    // W trybie --sql NIE wysylamy Game.tsx (chyba ze jawnie dodane)
    await gh("PATCH", `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, { sha: headSha });
    console.log(`\nGotowe! Ostatni commit: ${headSha.slice(0, 7)}`);
    return;
  }

  // ── Domyślny tryb: app/page.tsx + app/game/** ─────────────────────────────
  const gameLocalDir  = resolve(ROOT, "artifacts/plonopolis/src/game");
  const gameFiles: { githubPath: string; localPath: string }[] = [];

  if (existsSync(gameLocalDir)) {
    const collected = await collectDirFiles(gameLocalDir, "app/game");
    gameFiles.push(...collected);
    console.log(`Moduły game/: ${gameFiles.length} plików`);
  }

  const allCodeFiles = [
    { githubPath: "app/page.tsx", localPath: resolve(ROOT, "artifacts/plonopolis/src/Game.tsx") },
    ...gameFiles,
  ];

  console.log(`Wysylam app/page.tsx + ${gameFiles.length} modułów game/ (łącznie ${allCodeFiles.length} plików)...`);
  headSha = await pushCommit(allCodeFiles, headSha, CUSTOM_MSG ?? `sync z Replita [${now}]`);

  // Zaktualizuj ref gałęzi
  await gh("PATCH", `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, { sha: headSha });

  console.log(`\nGotowe! Ostatni commit: ${headSha.slice(0, 7)}`);
  console.log(`Railway zbuduje nowa wersje w ciagu ~3 minut.`);
}

main().catch(err => { console.error("Blad:", err instanceof Error ? err.message : err); process.exit(1); });
