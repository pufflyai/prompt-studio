import { defineExtensionView } from "@pstdio/sdk/extensions";
import { installPrismGlobal } from "@pstdio/ui";
import { createExampleView, viewBackgrounds } from "../create-view";
import type { ExampleProps, ExampleViewInput } from "../view-context";

export default defineExtensionView<ExampleProps>({
  async render({ mount, host, propsStore }) {
    await installPrismGlobal();
    const { ScribbleTree, scribbleStore } = await import("../apps/scribble");
    const Pages = (props: { input: ExampleViewInput }) => <ScribbleTree host={props.input.host} />;
    return createExampleView(Pages, scribbleStore, viewBackgrounds.sidenav).mount(mount, host, propsStore);
  },
});
