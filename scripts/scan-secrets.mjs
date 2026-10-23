import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const ignoredDirectories = new Set([".git", ".next", "node_modules", "coverage"]);
const checkedExtensions = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".md", ".yml", ".yaml", ".toml", ".rules"]);
const ignoredFiles = new Set(["package-lock.json", "firebaseConfig.txt"]);
const secretPatterns = [
  { name: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: "OpenAI-style secret", pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { name: "Resend API key", pattern: /\bre_[A-Za-z0-9_]{20,}\b/ },
  { name: "GitHub token", pattern: /\bgh[oprsu]_[A-Za-z0-9]{30,}\b/ },
  { name: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await sourceFiles(join(directory, entry.name)));
      continue;
    }
    if (!ignoredFiles.has(entry.name) && checkedExtensions.has(extname(entry.name))) files.push(join(directory, entry.name));
  }
  return files;
}

const findings = [];
for (const file of await sourceFiles(root)) {
  const content = await readFile(file, "utf8");
  for (const candidate of secretPatterns) {
    if (candidate.pattern.test(content)) findings.push(`${relative(root, file)}: possible ${candidate.name}`);
  }
}

if (findings.length) {
  console.error("Secret scan failed. Review these files without printing the credential value:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log("Secret scan passed.");
