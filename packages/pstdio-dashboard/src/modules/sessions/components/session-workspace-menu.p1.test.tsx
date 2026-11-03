import { expect, test } from "bun:test";
import { ChakraProvider } from "@chakra-ui/react";
import { psTheme } from "@pstdio/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionWorkspaceMenu } from "./session-workspace-menu";

test("a locked session without a selected workspace has no open action", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <SessionWorkspaceMenu
        workspaces={[]}
        selectedWorkspaceId=""
        selectedWorkspaceLabel=""
        onSelectWorkspace={() => {}}
        isDisabled
      />
    </ChakraProvider>,
  );
  expect(html).not.toContain('aria-label="Open workspace"');
  expect(html).toContain('aria-label="Select workspace"');
});
