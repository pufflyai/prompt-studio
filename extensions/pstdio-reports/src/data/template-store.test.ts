import { describe, expect, test } from "bun:test";
import { makeCommandContext } from "../commands/command-context.fixture";
import { createMemoryStorage } from "./memory-storage";
import { deleteReportTemplate, readReportTemplate, saveReportTemplate } from "./template-store";

describe("report template storage", () => {
  test("keeps the previous override when its replacement record cannot be saved", async () => {
    const storage = createMemoryStorage();
    const base = makeCommandContext({ storage, params: {} });
    await saveReportTemplate(base, { name: "review", content: "Previous override" });
    const collection = storage.collection.bind(storage);
    const failingStorage = {
      ...storage,
      collection<TItem>(name: string) {
        const api = collection<TItem>(name);
        return name === "templates" ? { ...api, put: async () => Promise.reject(new Error("write failed")) } : api;
      },
    };
    const failing = makeCommandContext({ storage: failingStorage, params: {} });

    await expect(saveReportTemplate(failing, { name: "review", content: "Replacement" })).rejects.toThrow(
      "write failed",
    );
    expect((await readReportTemplate(base, "review"))?.content).toBe("Previous override");
  });

  test("keeps a template readable when its logical deletion fails", async () => {
    const storage = createMemoryStorage();
    const base = makeCommandContext({ storage, params: {} });
    await saveReportTemplate(base, { name: "custom", content: "Keep me" });
    const collection = storage.collection.bind(storage);
    const failing = makeCommandContext({
      storage: {
        ...storage,
        collection<TItem>(name: string) {
          const api = collection<TItem>(name);
          return name === "templates"
            ? { ...api, delete: async () => Promise.reject(new Error("delete failed")) }
            : api;
        },
      },
      params: {},
    });

    await expect(deleteReportTemplate(failing, "custom")).rejects.toThrow("delete failed");
    expect((await readReportTemplate(base, "custom"))?.content).toBe("Keep me");
  });
});
