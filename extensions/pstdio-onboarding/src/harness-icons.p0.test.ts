import { expect, test } from "bun:test";
import { harnessChoices, resolveHarnessIcons } from "./catalog";

test("uses supplied catalog logos for every harness, including old installed metadata without an icon", () => {
  const marketplace = harnessChoices.map(({ id }) => ({
    extensionId: `pstdio.harness-${id}`,
    icon: `data:image/svg+xml;base64,${Buffer.from(`<svg><title>${id}</title></svg>`).toString("base64")}`,
  }));
  const logos = resolveHarnessIcons({
    marketplace,
    extensions: [{ extensionId: "pstdio.harness-codex", icon: null }],
  });
  for (const entry of marketplace)
    expect(logos[entry.extensionId.slice("pstdio.harness-".length) as (typeof harnessChoices)[number]["id"]]).toBe(
      entry.icon,
    );
  expect(
    resolveHarnessIcons({ marketplace, extensions: [{ extensionId: "pstdio.harness-codex", icon: "installed-icon" }] })
      .codex,
  ).toBe("installed-icon");
});
