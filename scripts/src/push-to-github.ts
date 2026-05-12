/**
 * Wysyla Game.tsx na GitHub do wlasciwej lokalizacji w projekcie Next.js.
 * Uzycie: pnpm --filter @workspace/scripts run push-to-github
 */
import { readFile, writeFile } from "fs/promises";
import { resolve } from "path";

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = "lee14original-web";
const REPO = "Plonopolis";
const BRANCH = "main";

if (!GITHUB_TOKEN) {
  console.error("Brak GITHUB_TOKEN w zmiennych srodowiskowych.");
  process.exit(1);
}

const ROOT = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

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

async function pushFile(githubPath: string, content: string, message: string) {
  const sha = await getFileSha(githubPath);
  const encoded = Buffer.from(content).toString("base64");
  await ghApi("PUT", `/repos/${OWNER}/${REPO}/contents/${githubPath}`, {
    message,
    content: encoded,
    branch: BRANCH,
    ...(sha ? { sha } : {}),
  });
  console.log(`  OK  ${githubPath}`);
}

async function main() {
  console.log(`Wysylam pliki gry na GitHub (${OWNER}/${REPO} @ ${BRANCH})...`);

  const gameTsxPath = resolve(ROOT, "artifacts/plonopolis/src/Game.tsx");
  const gameTsxContent = await readFile(gameTsxPath, "utf8");

  const pageContent = `import Game from "@/components/Game";

export default function Page() {
  return <Game />;
}
`;

  await pushFile("app/page.tsx", gameTsxContent, "sync: Game.tsx z Replita");

  console.log("\nGotowe! Railway automatycznie wdrozy zmiany.");
  console.log("Link do gry: https://plonopolis-production.up.railway.app/");
}

main().catch(err => {
  console.error("Nieoczekiwany blad:", err instanceof Error ? err.message : err);
  process.exit(1);
});
