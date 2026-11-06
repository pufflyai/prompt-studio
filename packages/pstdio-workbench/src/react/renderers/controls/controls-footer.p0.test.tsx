import { expect, test } from "bun:test";
import { ScopedDialog as Dialog } from "@pstdio/ui";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import type { ControlsFooterProps } from "./controls-footer";
import { ControlsFooter } from "./controls-footer";

const markup = (props: Partial<ControlsFooterProps>) =>
  renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <Dialog.Root open>
        <ControlsFooter
          visible
          dialog
          contribution={{
            source: "module",
            ownerId: "test",
            priority: 0,
            id: "device",
            title: "Device",
            executeQuery: () => ({ params: [] }),
          }}
          pending={false}
          submit={async () => {}}
          {...props}
        />
      </Dialog.Root>
    </WorkbenchThemeProvider>,
  );

test("a fixed dialog offers reset without an unusable cancel action", () => {
  const html = markup({
    contribution: {
      source: "module",
      ownerId: "test",
      priority: 0,
      id: "device",
      title: "Device",
      executeQuery: () => ({ params: [] }),
      reset: () => {},
    },
  });
  expect(html).toContain("Reset");
  expect(html).not.toContain("Cancel");
});

test("a closable dialog offers cancel", () => {
  expect(markup({ onClose: () => {} })).toContain("Cancel");
});
