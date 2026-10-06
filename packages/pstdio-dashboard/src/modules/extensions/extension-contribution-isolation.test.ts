import { expect, test } from "bun:test";
import type { ResolvedWorkbenchExtensionMetadata } from "@/shared/extensions/extension-localization";
import { registerHealthyExtensions } from "./extension-contribution-isolation";
import { metadata } from "./module-test-fixtures";

const withExtensions = (ids: string[]) =>
  ({
    ...metadata,
    extensions: ids.map((id) => ({ id, name: id, displayName: id, sourcePath: "" })),
    commands: ids.map((id) => ({ id: `${id}.command.run`, extensionId: id, title: "Run" })),
  }) as unknown as ResolvedWorkbenchExtensionMetadata;

test("registers every extension except the one that cannot register", () => {
  const registered: string[][] = [];
  const failures: string[] = [];
  const result = registerHealthyExtensions({
    metadata: withExtensions(["broken", "refers-to-later", "later"]),
    register: (subset) => {
      const ids = subset.extensions.map((extension) => extension.id);
      if (ids.includes("broken")) throw new Error("View already registered");
      if (ids.includes("refers-to-later") && !ids.includes("later")) throw new Error("Mode not registered");
      registered.push(ids);
      return { dispose: () => undefined };
    },
    onFailure: (extensionId) => failures.push(extensionId),
  });

  expect(result.metadata.extensions.map((extension) => extension.id)).toEqual(["refers-to-later", "later"]);
  expect(result.metadata.commands.map((command) => command.extensionId)).toEqual(["refers-to-later", "later"]);
  expect(failures).toEqual(["broken"]);
  expect(registered.at(-1)).toEqual(["refers-to-later", "later"]);
});
