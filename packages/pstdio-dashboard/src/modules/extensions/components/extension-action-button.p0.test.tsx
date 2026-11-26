import { expect, test } from "bun:test";
import { ChakraProvider, psTheme } from "@pstdio/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import { ExtensionActionButton } from "./extension-action-button";
import { createExtensionActions } from "./extension-actions";
import { ExtensionUpgradeProgress } from "./extension-upgrade-progress";

test("hiding a completed batch discards its result so it cannot reappear with later updates", async () => {
  const actions = createExtensionActions();
  await actions.runBatch([{ id: "one" }, { id: "two" }], async () => false);
  expect(actions.getSnapshot().batch).toBeDefined();
  let renderer: ReturnType<typeof create> | undefined;
  const environment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previousAct = environment.IS_REACT_ACT_ENVIRONMENT;
  environment.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    await act(async () => {
      renderer = create(
        <ChakraProvider value={psTheme}>
          <ExtensionUpgradeProgress
            upgradeCount={0}
            batch={actions.getSnapshot().batch}
            onUpgrade={() => {}}
            onDismiss={actions.dismissBatch}
          />
        </ChakraProvider>,
      );
    });
    expect(actions.getSnapshot().batch).toBeUndefined();
  } finally {
    await act(async () => renderer?.unmount());
    environment.IS_REACT_ACT_ENVIRONMENT = previousAct;
  }
});

test("running batch progress stays visible while its remaining updates are being changed", () => {
  const html = renderToStaticMarkup(
    <ChakraProvider value={psTheme}>
      <ExtensionUpgradeProgress
        upgradeCount={0}
        onUpgrade={() => {}}
        batch={{ ids: ["one", "two"], completed: 1, failed: 0, reviewRequired: 0, running: true }}
      />
    </ChakraProvider>,
  );
  expect(html).toContain('data-testid="extensions-upgrade-all"');
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('aria-valuenow="1"');
});

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
