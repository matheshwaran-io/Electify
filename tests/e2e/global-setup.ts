import { execFileSync } from "node:child_process";
import { E2E_DATABASE_URL, E2E_DB_NAME } from "./fixtures/constants";

/**
 * Recreates the throwaway e2e database from the current schema and seeds the
 * synthetic fixtures, so every run starts from the same known state.
 * Only ever touches the local `electify_e2e` database.
 */
export default function globalSetup() {
  const url = new URL(E2E_DATABASE_URL);
  if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== `/${E2E_DB_NAME}`) {
    throw new Error(`E2E tests only run against the local ${E2E_DB_NAME} database (got ${url.hostname}${url.pathname}).`);
  }
  const pg = ["-h", url.hostname, "-p", url.port || "5432", ...(url.username ? ["-U", url.username] : [])];
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL, DIRECT_URL: E2E_DATABASE_URL };
  execFileSync("dropdb", [...pg, "--if-exists", "--force", E2E_DB_NAME], { stdio: "inherit" });
  execFileSync("createdb", [...pg, E2E_DB_NAME], { stdio: "inherit" });
  // On Windows `npx` is `npx.cmd`, which Node only launches through a shell
  // (CVE-2024-27980). The arguments are fixed strings, so the shell is safe here.
  const npx = { shell: process.platform === "win32", env };
  execFileSync("npx", ["drizzle-kit", "push", "--force"], { stdio: "pipe", ...npx });
  execFileSync("npx", ["tsx", "tests/e2e/fixtures/seed.ts"], { stdio: "inherit", ...npx });
}
