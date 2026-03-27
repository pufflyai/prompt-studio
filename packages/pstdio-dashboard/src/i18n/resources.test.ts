import { describe, expect, it } from "bun:test";

const locales = ["es", "fr", "ja", "ko", "zh-Hans", "zh-Hant"] as const;

const readTicketsLocale = async (locale: string) =>
  (await Bun.file(new URL(`./locales/${locale}/tickets.json`, import.meta.url)).json()) as {
    conversation?: {
      workspace?: Record<string, string>;
    };
  };

describe("tickets locale resources", () => {
  it("keeps conversation workspace keys aligned across locales", async () => {
    const englishTickets = await readTicketsLocale("en");
    const englishWorkspaceKeys = Object.keys(englishTickets.conversation?.workspace ?? {});

    for (const locale of locales) {
      const localizedTickets = await readTicketsLocale(locale);

      expect(Object.keys(localizedTickets.conversation?.workspace ?? {})).toEqual(englishWorkspaceKeys);
    }
  });
});
