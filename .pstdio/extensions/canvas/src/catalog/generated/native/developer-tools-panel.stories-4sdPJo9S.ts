// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./queryClient-BgKKh9f4.ts";
import { t as n } from "./workbench-core-kaLFKJEn.ts";
import { t as r } from "./workbench-BbqJVWhj.ts";
import { t as i } from "./settings-resources-BmVO5oBi.ts";
import { i as a } from "./synced-settings-DHQMAu8t.ts";
import { t as o } from "./module-CcTIKy6K.ts";
import { n as s, t as c } from "./module-DIyXuzE3.ts";
import { useState as l } from "react";
import { Box as u } from "@chakra-ui/react";
import { jsx as d } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/performance/components/developer-tools-panel.stories.tsx
var f = {
	title: "Settings/Developer tools",
	component: s,
	args: {
		host: "desktop",
		performanceEnabled: !1,
		connectionStatusEnabled: !1,
		onPerformanceChange: () => void 0,
		onConnectionStatusChange: () => void 0,
		onDismissError: () => void 0
	}
}, p = {}, m = { args: {
	performanceEnabled: !0,
	connectionStatusEnabled: !0
} }, h = { args: {
	performanceEnabled: !0,
	host: "browser"
} }, g = { args: { performanceEnabled: void 0 } }, _ = { args: { error: "Could not change performance monitoring." } }, v = () => {
	let [s] = l(() => {
		let e = new t({ defaultOptions: { queries: { staleTime: Infinity } } });
		return e.setQueryData(["settings"], null), a({
			max_concurrent_sessions: null,
			notifications_enabled: !1,
			machine_tokens_enabled: !1
		}), e;
	}), [f] = l(() => {
		let e = n();
		return e.registerModule(o()), e.registerModule(c(e.settings)), e.commands.executeCommand(i, { panelId: "developer-tools" }), e;
	});
	return /* @__PURE__ */ d(e, {
		client: s,
		children: /* @__PURE__ */ d(u, {
			h: "100dvh",
			w: "full",
			children: /* @__PURE__ */ d(r, { workbench: f })
		})
	});
}, y = {
	parameters: { layout: "fullscreen" },
	render: () => /* @__PURE__ */ d(v, {})
};
export { g as Loading, p as Off, h as OnBrowser, m as OnDesktop, _ as SaveFailure, y as SettingsNavigation, f as default };
