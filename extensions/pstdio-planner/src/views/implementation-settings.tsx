import { defineExtensionView } from "@pstdio/sdk/extensions";
import { installPrismGlobal } from "@pstdio/ui";
import { renderTicketRoot } from "./view-root";

export default defineExtensionView({
  async render({ mount, host, t }) {
    await installPrismGlobal();
    const { ImplementationSettingsPanel } = await import("./implementation-settings-panel");
    return renderTicketRoot(mount, <ImplementationSettingsPanel host={host} t={t} />);
  },
});
