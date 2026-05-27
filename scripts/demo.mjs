#!/usr/bin/env node
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

process.chdir(rootDir);

function readEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .reduce((env, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return env;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        return env;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      env[key] = value;
      return env;
    }, {});
}

function runStep(label, command, args) {
  return new Promise((resolveStep, rejectStep) => {
    console.log(`\n> ${label}`);
    const child = spawn(command, args, { env: demoEnv, stdio: "inherit" });

    child.on("error", (error) => {
      rejectStep(new Error(`${label} could not start: ${error.message}`));
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolveStep();
        return;
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      rejectStep(new Error(`${label} failed with ${reason}.`));
    });
  });
}

function startLongRunningProcess(label, command, args) {
  console.log(`\n> Starting ${label}`);
  return spawn(command, args, {
    env: demoEnv,
    stdio: "inherit"
  });
}

let demoEnv = process.env;

async function main() {
  if (!existsSync(".env.local")) {
    copyFileSync(".env.example", ".env.local");
    console.log("> Created .env.local from .env.example");
  } else {
    console.log("> Using existing .env.local");
  }

  demoEnv = { ...process.env, ...readEnvFile(".env.local") };

  await runStep("Start Postgres and Redis", "docker", ["compose", "up", "-d"]);
  await runStep("Generate Prisma client", npmCommand, ["run", "prisma:generate"]);
  await runStep("Apply database migrations", npmCommand, ["run", "prisma:migrate"]);
  await runStep("Seed fictional Example Studio data", npmCommand, ["run", "prisma:seed"]);

  console.log("\nSparko demo is starting.");
  console.log("Open http://localhost:3000 when the Next.js server is ready.");
  console.log("Press Ctrl+C to stop both the app and worker.\n");

  const app = startLongRunningProcess("Next.js app", npmCommand, ["run", "dev"]);
  const worker = startLongRunningProcess("scheduled publishing worker", npmCommand, ["run", "worker"]);
  const children = [
    { label: "Next.js app", process: app },
    { label: "scheduled publishing worker", process: worker }
  ];
  let shuttingDown = false;

  function stopAll(signal = "SIGTERM") {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    for (const child of children) {
      if (!child.process.killed) {
        child.process.kill(signal);
      }
    }
  }

  process.on("SIGINT", () => stopAll("SIGINT"));
  process.on("SIGTERM", () => stopAll("SIGTERM"));

  for (const child of children) {
    child.process.on("exit", (code, signal) => {
      if (shuttingDown) {
        return;
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      console.error(`\n${child.label} stopped unexpectedly with ${reason}.`);
      stopAll();
      process.exit(code && code > 0 ? code : 1);
    });
  }
}

main().catch((error) => {
  console.error(`\nDemo startup failed: ${error.message}`);
  console.error("Check that Docker is running, then try npm run demo again.");
  process.exit(1);
});
