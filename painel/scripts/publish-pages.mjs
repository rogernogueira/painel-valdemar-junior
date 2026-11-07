import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const source = resolve(projectRoot, "dados/paineis/valdemar-junior");
const destination = resolve(projectRoot, "docs");

rmSync(destination, { recursive: true, force: true });
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true, force: true });
writeFileSync(resolve(destination, ".nojekyll"), "");
console.log(`GitHub Pages atualizado em ${destination}`);
