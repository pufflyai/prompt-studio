import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RuntimeDescriptor } from "pstdio/runtime";
import { removeTestDirectory } from "../testing/remove-test-directory";

interface ActiveRuntimeOptions {
  /** Refuse the first forced shutdown, as a runtime that cannot stop its work yet. */
  refuseFirstForcedShutdown: boolean;
  /** Hold the dashboard response until `releaseDashboard` is called. */
  holdDashboard: boolean;
}

const stopProcess = async (child: ChildProcess) => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  await new Promise<void>((resolveExit) => child.once("exit", () => resolveExit()));
};

/** A desktop-owned runtime that reports active work until a forced shutdown is accepted. */
export const startActiveRuntime = async (cleanup: Array<() => void | Promise<void>>, options: ActiveRuntimeOptions) => {
  const token = "desktop-active-work-secret";
  const home = mkdtempSync(join(tmpdir(), "pstdio-desktop-active-work-"));
  const descriptorPath = join(home, "runtime.json");
  const runtimeProcess = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  const eventResponses = new Set<ServerResponse>();
  const shutdownForces: boolean[] = [];
  const dashboardRequested = Promise.withResolvers<void>();
  const dashboardReleased = Promise.withResolvers<void>();
  if (!options.holdDashboard) dashboardReleased.resolve();
  let refuseForcedShutdown = options.refuseFirstForcedShutdown;
  cleanup.push(() => removeTestDirectory(home));
  cleanup.push(() => stopProcess(runtimeProcess));

  const server = createServer(async (request, response) => {
    if (request.headers.authorization !== `Bearer ${token}` && request.url?.startsWith("/runtime/")) {
      response.writeHead(401).end();
      return;
    }
    if (request.url === "/runtime/ready") {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({ ok: true, protocolVersion: 1, instanceId: "active-runtime", ownerType: "desktop" }),
      );
      return;
    }
    if (request.url === "/runtime/browser-login") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ url: `http://${request.headers.host}/#browser-login=fixture-code` }));
      return;
    }
    if (request.url === "/runtime/events") {
      response.setHeader("content-type", "text/event-stream");
      response.write(": connected\n\n");
      eventResponses.add(response);
      response.on("close", () => eventResponses.delete(response));
      return;
    }
    if (request.url === "/runtime/shutdown") {
      let requestBody = "";
      for await (const chunk of request) requestBody += String(chunk);
      const force = (JSON.parse(requestBody) as { force?: boolean }).force === true;
      shutdownForces.push(force);
      if (!force) {
        response.setHeader("content-type", "application/json");
        response.writeHead(409).end(
          JSON.stringify({
            error: "runtime_active",
            activity: {
              sessions: [{ id: "session-1", label: "PS-217 implementation" }],
              terminals: [{ id: "terminal-1", label: "Desktop tests" }],
              jobs: [{ id: "job-1", label: "Package verification" }],
            },
          }),
        );
        return;
      }
      if (refuseForcedShutdown) {
        refuseForcedShutdown = false;
        response.writeHead(503).end();
        return;
      }
      response.writeHead(202).end();
      rmSync(descriptorPath, { force: true });
      await stopProcess(runtimeProcess);
      return;
    }
    dashboardRequested.resolve();
    await dashboardReleased.promise;
    response.setHeader("content-type", "text/html");
    response.end(
      '<!doctype html><html><body><main>Owned Prompt Studio dashboard<textarea aria-label="Draft"></textarea></main></body></html>',
    );
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  cleanup.push(async () => {
    dashboardReleased.resolve();
    for (const response of eventResponses) response.end();
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Electron test runtime did not bind a port");
  const descriptor: RuntimeDescriptor = {
    schemaVersion: 1,
    protocolVersion: 1,
    pid: runtimeProcess.pid!,
    instanceId: "active-runtime",
    ownerType: "desktop",
    origin: `http://127.0.0.1:${address.port}`,
    token,
    appVersion: "0.25.2",
    startedAt: new Date().toISOString(),
  };
  writeFileSync(descriptorPath, JSON.stringify(descriptor));
  return {
    home,
    descriptor,
    shutdownForces,
    dashboardRequested: dashboardRequested.promise,
    releaseDashboard: () => dashboardReleased.resolve(),
  };
};
