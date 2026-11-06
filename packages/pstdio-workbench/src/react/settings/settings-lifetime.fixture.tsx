import { installPrismGlobal } from "@pstdio/ui";

// Built editor modules register Prism languages while the workbench entry evaluates.
await installPrismGlobal();
await import("./settings-lifetime-host.fixture");
