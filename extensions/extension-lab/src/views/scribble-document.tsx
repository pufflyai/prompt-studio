import { defineExtensionView } from "@pstdio/sdk/extensions";
import { installPrismGlobal } from "@pstdio/ui";
import { createExampleView } from "../create-view";
import type { ExampleProps } from "../view-context";

export default defineExtensionView<ExampleProps>({
  async render({ mount, host, propsStore }) {
    await installPrismGlobal();
    const { DocumentCanvas, scribbleStore } = await import("../apps/scribble");
    return createExampleView(DocumentCanvas, scribbleStore).mount(mount, host, propsStore);
  },
});
