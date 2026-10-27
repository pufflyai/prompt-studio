// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./use-workbench-store-BMaFgEbb.ts";
import { t } from "./shallow-BYHDNLn2.ts";
// packages/pstdio-workbench/src/react/shared/use-workbench-location-resource.ts
var n = (t) => e(t.pages.store, (e) => e.location?.resource), r = (t) => e(t.modes.store, (e) => e.activeModeId), i = (n, r) => (e(n.modes.store, (e) => e.activeModeId), e(n.pages.store, (e) => e.activePageId), e(n.layout.store, t(() => n.shell.getPanelPolicy(r))));
export { r as n, n as r, i as t };
