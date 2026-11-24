import { expect, test } from "bun:test";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { ExtensionActionButton } from "./extension-action-button";

test("an active install shows its label and spinner without elapsed seconds", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <ExtensionActionButton action={{ status: "running", label: "Installing" }}>Install</ExtensionActionButton>
    </ChakraProvider>,
  );
  expect(html).toContain('aria-busy="true"');
  expect(html).not.toContain('role="progressbar"');
  expect(html).toContain('aria-label="Installing"');
});

test("failed batch feedback announces its status once and retains direct retry without elapsed seconds", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <ExtensionActionButton
        action={{ status: "error", label: "Two failures", error: "Two failures" }}
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

test("unconfirmed installation stays disabled and exposes dismissal without a retry action", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <ExtensionActionButton
        action={{ status: "error", label: "Outcome unconfirmed", retryable: false }}
        onRetry={() => {}}
        onDismiss={() => {}}
      >
        Install
      </ExtensionActionButton>
    </ChakraProvider>,
  );
  expect(html).toContain('aria-label="Outcome unconfirmed"');
  expect(html).toContain('disabled=""');
  expect(html).not.toContain("Retry");
  expect(html).toContain('data-testid="extension-action-dismiss"');
});
