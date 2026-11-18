import { expect, test } from "bun:test";
import { workbenchPageDefinitions } from "./builtin-refs";
import { sessionBrowser } from "./session-browser-refs";

test("provider page IDs remain outside the legacy host reservation", () => {
  const reserved = Object.values(workbenchPageDefinitions).map((page) => page.ref.id);
  for (const page of Object.values(sessionBrowser.pages)) expect(reserved).not.toContain(page.id);
});
