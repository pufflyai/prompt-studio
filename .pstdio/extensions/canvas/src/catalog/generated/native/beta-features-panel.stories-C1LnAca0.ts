// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./QueryClientProvider-LIjzams-.ts";
import { t } from "./queryClient-BgKKh9f4.ts";
import { t as n } from "./workbench-core-N58OeDyx.ts";
import { t as r } from "./workbench-BYYWgWSr.ts";
import { t as i } from "./settings-resources-BmVO5oBi.ts";
import { i as a } from "./synced-settings-DHQMAu8t.ts";
import { r as o, t as s } from "./module-CS1X8tKQ.ts";
import { useState as c } from "react";
import { Box as l } from "@chakra-ui/react";
import { jsx as u } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/settings/components/beta-features-panel.stories.tsx
var d = {
	title: "Settings/Beta features",
	component: o,
	args: {
		onChange: () => void 0,
		onRetry: () => void 0
	}
}, f = {
	notifications_enabled: !1,
	machine_tokens_enabled: !1
}, p = { args: { settings: f } }, m = { args: { settings: {
	notifications_enabled: !0,
	machine_tokens_enabled: !0
} } }, h = { args: { settings: void 0 } }, g = { args: {
	settings: f,
	error: "Could not save settings. Try again."
} }, _ = () => {
	let [o] = c(() => {
		let e = new t({ defaultOptions: { queries: { staleTime: Infinity } } });
		return e.setQueryData(["settings"], null), a({
			max_concurrent_sessions: null,
			...f
		}), e;
	}), [d] = c(() => {
		let e = n();
		return e.registerModule(s()), e.commands.executeCommand(i, { panelId: "beta-features" }), e;
	});
	return /* @__PURE__ */ u(e, {
		client: o,
		children: /* @__PURE__ */ u(l, {
			h: "100dvh",
			w: "full",
			children: /* @__PURE__ */ u(r, { workbench: d })
		})
	});
}, v = {
	parameters: { layout: "fullscreen" },
	render: () => /* @__PURE__ */ u(_, {})
};
export { v as ExperimentalNavigation, g as Failure, h as Loading, p as Off, m as On, d as default };
