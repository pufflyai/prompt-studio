import { describe, expect, test } from "bun:test";
import { mockFetchSequence } from "@/test-utils/mock-fetch";
import { seedBundledTemplates } from "./seed-bundled-templates";

const templateResponse = {
  status: 201,
  body: { id: "tpl", name: "t", template_type: "document", is_default: false },
};

describe("seedBundledTemplates", () => {
  test("seeds bundled document templates including lessons learned", async () => {
    mockFetchSequence(Array.from({ length: 7 }, () => templateResponse));

    await seedBundledTemplates("http://api.test", "proj-1");

    expect(globalThis.fetch).toHaveBeenCalledTimes(7);

    const calls = (
      globalThis.fetch as typeof fetch & {
        mock: { calls: Array<[string, RequestInit]> };
      }
    ).mock.calls;
    const createdTemplates = calls.map(([, init]) => JSON.parse(String(init.body)) as { name: string });

    expect(createdTemplates.map((template) => template.name)).toEqual([
      "ticket",
      "proposal",
      "prd",
      "adr",
      "cookbook",
      "review-me",
      "lessons-learned",
    ]);
  });
});
