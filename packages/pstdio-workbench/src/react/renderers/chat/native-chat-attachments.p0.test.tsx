import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { WorkbenchThemeProvider } from "../../theme/workbench-theme-provider";
import { NativeChatAttachmentList } from "./native-chat-attachments";

test("native draft images expose a thumbnail and a separate remove control", () => {
  const markup = renderToStaticMarkup(
    <WorkbenchThemeProvider>
      <NativeChatAttachmentList
        attachments={[{ id: "image", name: "diagram.png", mediaType: "image/png", url: "data:image/png;base64,AA==" }]}
        disabled={false}
        remove={() => {}}
      />
    </WorkbenchThemeProvider>,
  );
  expect(markup).toContain('alt="diagram.png preview thumbnail"');
  expect(markup).toContain('aria-label="Remove diagram.png"');
});
