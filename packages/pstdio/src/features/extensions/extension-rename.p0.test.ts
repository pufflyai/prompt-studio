import { expect, test } from "bun:test";
import type { ExtensionCommandRecord } from "@pstdio/sdk/api";
import {
  buildExtensionCommandTable,
  dispatchExtensionCliCommand,
  renderCommandHelp,
  renderNamespaceHelp,
} from "./extension-cli-router";

const command: ExtensionCommandRecord = {
  id: "pstdio.notes.command.notes.create",
  extensionId: "pstdio.notes",
  title: "Create note",
  cliPath: "pstdio.notes create",
  cliAliases: ["pstdio.pstdio-notes notes create", "pstdio-notes notes create", "pstdio.notes notes create"],
  params: { title: { type: "text" } },
};

for (const flags of [[], ["--json"], ["--stream"]]) {
  test.each([
    command.cliPath!,
    ...command.cliAliases!,
  ])(`Notes routes execute once with clean output (${flags.join(" ")}) at %s`, async (path) => {
    const output: string[] = [];
    const errors: string[] = [];
    const calls: string[] = [];
    const outcome = { ok: true as const, status: "success" as const, value: { title: "Retained" } };
    const status = await dispatchExtensionCliCommand({
      rawArgs: [...path.split(" "), ...flags, "--title", "Retained"],
      deps: {
        cwd: () => "/project",
        resolveProjectId: () => ({ projectId: "project", root: null }),
        listCommands: async () => ({ commands: [command], diagnostics: [] }),
        execute: async (id, request) => {
          calls.push(id);
          expect(request.params).toEqual({ title: "Retained" });
          return { commandId: id, extensionId: command.extensionId, outcome };
        },
        streamCommand(_project, id) {
          calls.push(id);
          return {
            async *[Symbol.asyncIterator]() {
              yield "value";
            },
            outcome: Promise.resolve(outcome),
            result: Promise.resolve(outcome.value),
            cancel: async () => {},
          };
        },
        log: (line) => {
          output.push(line);
        },
        error: (line) => {
          errors.push(line);
        },
      },
    });
    expect(status).toBe(0);
    expect(calls).toEqual([command.id]);
    if (flags.length) for (const line of output) expect(() => JSON.parse(line)).not.toThrow();
    expect(output.join("\n")).not.toContain("Deprecated");
    if (path !== command.cliPath && !flags.includes("--json"))
      expect(errors).toEqual([expect.stringContaining("pst pstdio.notes create")]);
    else expect(errors).toEqual([]);
  });
}

test("canonical namespace help lists concise commands and labels deprecated aliases in detail", () => {
  const table = buildExtensionCommandTable([command]);
  expect(renderNamespaceHelp("pstdio.notes", table)).toContain("pstdio pstdio.notes create");
  expect(renderNamespaceHelp("pstdio.notes", table)).not.toContain("pstdio.notes notes create");
  expect(renderCommandHelp(command)).toContain("deprecated");
});

test("a different publisher cannot win a historical short namespace by installation order", () => {
  const other = {
    ...command,
    id: "alice.pstdio-notes.command.create",
    extensionId: "alice.pstdio-notes",
    cliPath: "alice.pstdio-notes notes create",
    cliAliases: [],
  };
  for (const commands of [
    [command, other],
    [other, command],
  ]) {
    const table = buildExtensionCommandTable(commands);
    expect(table.byPath.get("pstdio-notes notes create")).toBeUndefined();
    expect(table.byPath.get("pstdio.pstdio-notes notes create")?.id).toBe(command.id);
  }
});
