import { describe, expect, test } from "bun:test";
import { defineExtension } from "./define-extension";
import { params } from "./params";
import { commandsOf } from "./refs";

describe("commandsOf", () => {
  test("derives typed command refs from contributions with an explicit package name", () => {
    const extension = defineExtension({
      commands: {
        awaken: {
          title: "Awaken",
          params: { title: params.text() },
          async run() {
            return { awakened: true };
          },
        },
      },
    });

    const commands = commandsOf("extension-lab", extension);

    expect(commands.awaken.id).toBe("extension-lab.awaken");
  });
});
