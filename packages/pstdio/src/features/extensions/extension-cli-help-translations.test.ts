import { expect, test } from "bun:test";
import type { ExtensionCommandRecord, ListExtensionCommandsResponse } from "@pstdio/sdk/api";
import { createClient } from "@pstdio/sdk/client";
import { dispatchExtensionCliCommand, renderCommandHelp } from "./extension-cli-router";

const command: ExtensionCommandRecord = {
  id: "notes.save",
  extensionId: "acme.notes",
  title: "Save note",
  cliPath: "notes save",
  params: {
    revision: {
      type: "number",
      description: { $l10n: "revision.help", default: "Compare the current revision." },
    },
  },
};

test("command help displays localized parameter defaults directly", () => {
  expect(renderCommandHelp(command)).toContain("--revision <number>  Compare the current revision.");
});

test("command help translates parameter descriptions with locale and default-locale fallbacks", async () => {
  const metadata: ListExtensionCommandsResponse = {
    commands: [command],
    diagnostics: [],
    translations: [
      {
        extensionId: command.extensionId,
        defaultLocale: "en",
        bundles: {
          en: { "revision.help": "Compare the saved revision." },
          fr: { "revision.help": "Comparer la révision actuelle." },
        },
      },
    ],
  };
  const server = Bun.serve({ port: 0, fetch: () => Response.json(metadata) });
  const client = createClient({ baseUrl: server.url.toString() });
  const previousLocale = process.env.LC_ALL;
  try {
    for (const [locale, description] of [
      ["fr_FR.UTF-8", "Comparer la révision actuelle."],
      ["de_DE.UTF-8", "Compare the saved revision."],
    ]) {
      process.env.LC_ALL = locale;
      const output: string[] = [];
      const result = await dispatchExtensionCliCommand({
        rawArgs: ["notes", "save", "--help"],
        deps: {
          listCommands: (projectId) => client.extensions.listCommands(projectId),
          log: (message) => output.push(message),
          resolveProjectId: () => ({ projectId: "project", root: null }),
        },
      });
      expect(result).toBe(0);
      expect(output.join("\n")).toContain(`--revision <number>  ${description}`);
    }
  } finally {
    if (previousLocale === undefined) delete process.env.LC_ALL;
    else process.env.LC_ALL = previousLocale;
    server.stop(true);
  }
});
