import { expect, test } from "bun:test";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardExtensionMetadata } from "@/shared/extensions/types";
import { AvailableExtensionDetail } from "./available-extension-detail";

test("available Git extensions show source contributions when catalog and manifest identities differ", () => {
  const metadata: DashboardExtensionMetadata = {
    extensions: [{ id: "source.tool", name: "tool", displayName: "Source tool", sourcePath: "" }],
    commands: [{ id: "source.tool.command.run", extensionId: "source.tool", title: "Run source tool" }],
    menuContributions: [],
    modes: [],
    pages: [],
    views: [],
    viewMenus: [],
    placements: [],
    resourceKinds: [],
    navigationItems: [],
    navigationTrees: [],
    statusBarItems: [],
    settingsPanels: [],
    diagnostics: [],
  };
  const markup = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <AvailableExtensionDetail
        extension={{
          installName: "tool",
          extensionId: "catalog.tool",
          displayName: "Catalog tool",
          description: "A Git extension",
          installed: false,
          origin: { kind: "git", url: "https://example.com/tools.git", ref: "main", path: "tool" },
        }}
        metadata={metadata}
        loadingContributions={false}
        installing={false}
        onBack={() => {}}
        onInstall={() => {}}
      />
    </ChakraProvider>,
  );
  expect(markup).toContain("catalog.tool");
  expect(markup).toContain("Run source tool");
});
