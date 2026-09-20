import { expect } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION_API_VERSION } from "pstdio-api-contracts/extension-kernel";

export const writeNavigationExtension = (root: string) => {
  const source = join(root, "extension-sources", "navigation-probe");
  mkdirSync(source, { recursive: true });
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "navigation-probe",
      version: "1.0.0",
      publisher: "test",
      main: "./extension.ts",
      type: "module",
      engines: { pstdio: EXTENSION_API_VERSION },
    }),
  );
  writeFileSync(
    join(source, "extension.ts"),
    `export default { commands: [{
      id: "open", ref: { kind: "command", id: "open" }, title: "Open", cli: true,
      run(ctx: { navigation: { open(target: unknown): void } }) {
        ctx.navigation.open({ kind: "href", href: "https://example.com/created" });
        return { id: "created" };
      },
    }] };\n`,
  );
  return source;
};

export const expectPackagedNavigation = async (input: {
  baseUrl: string;
  projectId: string;
  headers: Record<string, string>;
}) => {
  for (const source of ["dashboard", "cli"]) {
    const response = await fetch(
      `${input.baseUrl}/v1/projects/${input.projectId}/extensions/commands/test.navigation-probe.command.open/execute`,
      {
        method: "POST",
        headers: { ...input.headers, "content-type": "application/json" },
        body: JSON.stringify({ source, params: {} }),
      },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.outcome.status).toBe("success");
    expect(body.outcome.value).toEqual({ id: "created" });
    if (source === "dashboard") {
      expect(body.outcome.navigationRequests).toEqual([{ kind: "href", href: "https://example.com/created" }]);
    } else {
      expect(body.outcome.navigationRequests).toBeUndefined();
    }
  }
};
