import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, delimiter } from "node:path";

const [mode, ...args] = process.argv.slice(2);
const scripts = {
  init: "scripts/init-tidecloak.sh",
  doctor: ".tide-pack/templates/shared/tide-doctor.sh",
};
if (!scripts[mode] || !existsSync(scripts[mode])) {
  console.error("Tide script missing. Run scripts/setup.ps1 to fetch the official pack.");
  process.exit(1);
}
const bash = process.platform === "win32" && existsSync("C:/Program Files/Git/bin/bash.exe")
  ? "C:/Program Files/Git/bin/bash.exe" : "bash";
const result = spawnSync(bash, [scripts[mode], ...args], {
  stdio: "inherit",
  env: { ...process.env, PATH: `${resolve(".tools/bin")}${delimiter}${process.env.PATH}` },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
