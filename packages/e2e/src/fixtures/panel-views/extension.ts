import { defineExtension } from "@pstdio/sdk/extensions";
import { createPanelViewFixture } from "./panel-views";
export default defineExtension(createPanelViewFixture(import.meta.url));
