import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { NativeChatControls } from "./native-chat-controls";

test("native composer requests compact harness controls without changing settings constraints", () => {
  const fields: unknown[] = [];
  const markup = renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatControls
        run={async () => {}}
        conversation={{
          harness: {
            commands: [],
            slashCommands: true,
            modes: [{ id: "goal", label: "Goal", description: "Goal", state: "Inactive", actions: [] }],
          },
          controls: [
            {
              id: "agent",
              name: "Agent",
              type: "harness",
              defaultValue: { harnessId: "" },
              lockIdentity: true,
              settingsMode: "resolved",
            },
          ],
        }}
        draft={{ text: "Keep draft", attachments: [], values: { agent: { harnessId: "claude", model: "sonnet" } } }}
        editingQueuedRequest
        changeValues={() => {}}
        renderParamField={(field) => {
          fields.push(field);
          return <button type="button">Sonnet</button>;
        }}
      />
    </WorkbenchThemeProvider>,
  );
  expect(markup.indexOf(">Sonnet<")).toBeLessThan(markup.indexOf('aria-label="Harness controls"'));
  expect(fields).toMatchObject([
    { harness: { presentation: "chat", lockIdentity: true, preserveSettings: true, settingsMode: "resolved" } },
  ]);
});
