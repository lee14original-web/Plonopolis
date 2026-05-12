/**
 * Wysyla biezacy commit SHA na GitHub przez API (bez uzycia git remote).
 * Uzycie: pnpm --filter @workspace/scripts run push-to-github
 */
import { execSync } from "child_process";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "lee14original-web";
const REPO = "Plonopolis";
const BRANCH = "main";

if (!GITHUB_TOKEN) {
  console.error("Brak GITHUB_TOKEN w zmiennych srodowiskowych.");
  process.exit(1);
}

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

function git(cmd: string): string {
  return execSync(`git --no-optional-locks ${cmd}`, { encoding: "utf8", cwd: ROOT }).trim();
}

async function ghApi(method: string, path: string, body?: unknown) {
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
  if (!res.ok) {
    throw new Error(`GitHub API ${method} ${path} => ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function getFileSha(filePath: string): Promise<string | undefined> {
  try {
    const data = await ghApi("GET", `/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`);
    return data.sha as string;
  } catch {
    return undefined;
  }
}

async function pushFile(filePath: string, content: string) {
  const sha = await getFileSha(filePath);
  const encoded = Buffer.from(content).toString("base64");
  const commitMsg = `sync: ${filePath}`;
  await ghApi("PUT", `/repos/${OWNER}/${REPO}/contents/${filePath}`, {
    message: commitMsg,
    content: encoded,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  });
  console.log(`  OK  ${filePath}`);
}

async function main() {
  console.log(`Wysylam zmienione pliki do GitHub (${OWNER}/${REPO} @ ${BRANCH})...`);

  let changedFiles: string[] = [];
  try {
    const output = git("diff --name-only HEAD~1 HEAD");
    changedFiles = output.split("\n").filter(Boolean);
  } catch {
    console.log("Nie mozna ustalic git diff — wybieram recznie pliki gry.");
    changedFiles = ["artifacts/plonopolis/src/Game.tsx"];
  }

  if (changedFiles.length === 0) {
    console.log("Brak zmian do wyslania.");
    return;
  }

  console.log(`Pliki do wyslania (${changedFiles.length}):`);
  changedFiles.forEach(f => console.log("  -", f));
  console.log("");

  const { readFile } = await import("fs/promises");
  const { existsSync } = await import("fs");
  const { resolve } = await import("path");

  let ok = 0;
  let skip = 0;
  for (const filePath of changedFiles) {
    const absPath = resolve(ROOT, filePath);
    if (!existsSync(absPath)) {
      console.log(`  SKIP (nie istnieje lokalnie): ${filePath}`);
      skip++;
      continue;
    }
    try {
      const content = await readFile(absPath, "utf8");
      await pushFile(filePath, content);
      ok++;
    } catch (err) {
      console.error(`  BLAD: ${filePath}:`, err instanceof Error ? err.message : err);
    }
  }

  console.log(`\nGotowe! Wyslano: ${ok}, pominieto: ${skip}.`);
}

main().catch(err => {
  console.error("Nieoczekiwany blad:", err);
  process.exit(1);
});
