/**
 * python.ts — async bridge to the Python module under test.
 *
 * Every call here is async and every caller awaits it. `execFileSync` would be
 * shorter, and it blocks Node's event loop for the whole child process: an
 * integration test that starts an HTTP fixture in-process and then calls the
 * child synchronously deadlocks, because the server can never accept the
 * connection the child is sitting there waiting on. Every fetch then fails as
 * a timeout and the failure looks like a bug in the fetching code.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { execFile } from "node:child_process";
import { realpathSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

import { repoRoot } from "./repo.ts";

const run = promisify(execFile);

export const bridgePath = join(repoRoot, "scripts", "testkit", "bridge.py");

export interface BridgeFailure {
  error: string;
}

/**
 * Calls one bridge op and returns its parsed JSON response.
 *
 * Note the op is passed as an argv element, never interpolated into a shell
 * string — there is no shell in this path at all.
 */
export async function bridge<T = Record<string, unknown>>(
  op: string,
  request: Record<string, unknown> = {},
  options: { timeoutMs?: number } = {},
): Promise<T & Partial<BridgeFailure>> {
  const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = execFile(
      "python3",
      [bridgePath, op],
      { timeout: options.timeoutMs ?? 20_000, maxBuffer: 16 * 1024 * 1024 },
      (error, out, err) => {
        if (error && !out) reject(error);
        else resolve({ stdout: out.toString(), stderr: err.toString() });
      },
    );
    // execFile has no `input` option — that belongs to execFileSync. Without
    // closing stdin ourselves the child blocks on read() until the timeout,
    // and every op fails as a timeout that looks like slow Python.
    child.stdin!.end(JSON.stringify(request));
  });

  const text = stdout.trim();
  if (text === "") {
    throw new Error(`bridge.py ${op} wrote nothing to stdout; stderr was: ${stderr.trim() || "(empty)"}`);
  }
  try {
    return JSON.parse(text) as T & Partial<BridgeFailure>;
  } catch {
    throw new Error(`bridge.py ${op} wrote non-JSON: ${text.slice(0, 400)}`);
  }
}

/** Runs a shipped skill script directly, the way the skill documents it. */
export async function runScript(
  scriptPath: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv; timeoutMs?: number } = {},
): Promise<{ code: number; stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await run(join(repoRoot, scriptPath), args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...options.env },
      timeout: options.timeoutMs ?? 30_000,
      maxBuffer: 16 * 1024 * 1024,
    });
    return { code: 0, stdout: stdout.toString(), stderr: stderr.toString() };
  } catch (error) {
    const failure = error as { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof failure.code === "number" ? failure.code : 1,
      stdout: failure.stdout?.toString() ?? "",
      stderr: failure.stderr?.toString() ?? "",
    };
  }
}

/**
 * True when `child` is inside `parent`.
 *
 * `path.resolve` is purely lexical, and on macOS `$TMPDIR` is a symlink:
 * Node hands back `/var/folders/...` while Python's `Path.resolve()` follows
 * the link to `/private/var/folders/...`. Comparing the two as strings says a
 * directory is not inside itself. Resolve both sides for real.
 */
export function contains(parent: string, child: string): boolean {
  const realParent = realpathSync(parent);
  const realChild = realpathSync(child);
  return realChild === realParent || realChild.startsWith(realParent + "/");
}
