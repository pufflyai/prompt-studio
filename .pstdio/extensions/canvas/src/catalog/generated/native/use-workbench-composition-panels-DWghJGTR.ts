// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./use-workbench-store-BMaFgEbb.ts";
// packages/pstdio-workbench/src/react/shared/use-workbench-composition-panels.ts
var t = (t) => {
	"use no memo";
	return e(t.layout.store, (e) => e), e(t.modes.store, (e) => e.activeModeId), e(t.pages.store, (e) => e), e(t.commands.store, (e) => e), e(t.context.store, (e) => e), {
		main: t.composition.panelsFor("main"),
		secondary: t.composition.panelsFor("secondary"),
		side: t.composition.panelsFor("side")
	};
};
export { t };
