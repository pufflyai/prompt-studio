import { expect, test } from "bun:test";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { ExtensionActionButton } from "./extension-action-button";

test("completed installs expose an attached dismiss control without terminal seconds", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <ExtensionActionButton
        action={{ status: "success", label: "Installed", startedAt: 1000, finishedAt: 13000 }}
        onDismiss={() => {}}
      >
        Install
      </ExtensionActionButton>
    </ChakraProvider>,
  );
  expect(html).toContain('aria-label="Installed"');
  expect(html).toContain('data-testid="extension-action-dismiss"');
});

test("active individual actions expose busy state without an individual progress bar", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <ExtensionActionButton action={{ status: "running", label: "Upgrading", startedAt: Date.now() }}>
        Upgrade
      </ExtensionActionButton>
    </ChakraProvider>,
  );
  expect(html).toContain('aria-busy="true"');
  expect(html).not.toContain('role="progressbar"');
});

test("failed batch feedback announces its status once and retains direct retry without elapsed seconds", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <ExtensionActionButton
        action={{ status: "error", label: "Two failures", error: "Two failures", startedAt: 1000, finishedAt: 13000 }}
        onRetry={() => {}}
        retryLabel="Retry all"
        onDismiss={() => {}}
      >
        Upgrade all
      </ExtensionActionButton>
    </ChakraProvider>,
  );
  const visible = html.replace(/<style[^>]*>.*?<\/style>/gs, "").replace(/<[^>]+>/g, "");
  expect(visible.match(/Two failures/g)).toHaveLength(1);
  expect(html).toContain('aria-label="Two failures · Retry all"');
  expect(html).toContain('data-testid="extension-action-dismiss"');
});
