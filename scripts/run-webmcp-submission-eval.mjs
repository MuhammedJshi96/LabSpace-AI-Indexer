import { spawn } from "node:child_process";
import console from "node:console";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import process from "node:process";

const target = "https://labspace-agent-twin.onrender.com/";
const evaluator = "webmcp-evals@0.0.4";
const outputDir = resolve("output/webmcp-evals/submission");
const npxCli = resolve(dirname(process.execPath), "node_modules/npm/bin/npx-cli.js");
const args = [
  "--yes",
  evaluator,
  "--chrome-channel",
  "chrome",
  "smoke",
  "--url",
  target,
  "--evals",
  "docs/webmcp/evals/submission-smoke.json",
];

mkdirSync(outputDir, { recursive: true });

const environment = { ...process.env, FORCE_COLOR: "0" };
delete environment.NO_COLOR;

const child = spawn(process.execPath, [npxCli, ...args], {
  cwd: process.cwd(),
  env: environment,
  windowsHide: true,
});

let stdout = "";
let stderr = "";
child.stdout.on("data", (chunk) => {
  const text = chunk.toString();
  stdout += text;
  process.stdout.write(text);
});
child.stderr.on("data", (chunk) => {
  const text = chunk.toString();
  stderr += text;
  process.stderr.write(text);
});

const exitCode = await new Promise((resolveExit, reject) => {
  child.once("error", reject);
  child.once("close", (code) => resolveExit(code ?? 1));
});

// eslint-disable-next-line no-control-regex
const stripAnsi = (value) => value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, "");
const transcript = stripAnsi(`${stdout}${stderr}`).trim();
const summary = transcript.match(/Passed steps:\s*(\d+)\/(\d+) across (\d+) case/);
const passedSteps = summary ? Number(summary[1]) : 0;
const totalSteps = summary ? Number(summary[2]) : 0;
const cases = summary ? Number(summary[3]) : 0;
const passed = exitCode === 0 && totalSteps > 0 && passedSteps === totalSteps;
const generatedAt = new Date().toISOString();

writeFileSync(resolve(outputDir, "latest.txt"), `${transcript}\n`, "utf8");
writeFileSync(
  resolve(outputDir, "latest.json"),
  `${JSON.stringify(
    {
      generatedAt,
      target,
      evaluator,
      mode: "deterministic-smoke",
      cases,
      passedSteps,
      totalSteps,
      passed,
      note: "Concrete WebMCP call execution; natural-language model selection is outside this smoke mode.",
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log(`\nSaved submission evidence to ${outputDir}`);
if (!passed) process.exitCode = exitCode || 1;
