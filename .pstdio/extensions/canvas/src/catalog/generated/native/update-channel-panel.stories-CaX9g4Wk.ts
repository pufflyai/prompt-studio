// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { n as e, t } from "./QueryClientProvider-LIjzams-.ts";
import { t as n } from "./useQuery-OeRqqLZF.ts";
import { t as r } from "./queryClient-BgKKh9f4.ts";
import { t as i } from "./useMutation-Dy9eufiq.ts";
import { t as a } from "./useTranslation-DvWg4zeU.ts";
import { t as o } from "./workbench-core-kaLFKJEn.ts";
import { t as s } from "./workbench-BbqJVWhj.ts";
import { t as c } from "./settings-resources-BmVO5oBi.ts";
import { i as l } from "./synced-settings-7p2HqHPp.ts";
import { t as u } from "./module-Dixbes9T.ts";
import { t as d } from "./module-C7OfS5VB.ts";
import { useState as f } from "react";
import { Box as p, Stack as m, Text as h } from "@chakra-ui/react";
import { AlertMessage as g } from "@pstdio/ui";
import { jsx as _, jsxs as v } from "react/jsx-runtime";
import { ParamEditorRow as y } from "@pstdio/ui/param-editor";
// packages/pstdio-dashboard/src/modules/updates/components/update-channel-panel.tsx
var b = ["desktop", "update-channel"], x = ["desktop", "app-info"], S = (e) => {
	let { channel: t, version: n, saving: r, error: i, onChange: o, onDismissError: s } = e, { t: c } = a("settings"), l = {
		id: "channel",
		name: c("updates.channel"),
		type: "selection",
		defaultValue: t ?? "",
		placeholder: c("updates.loading"),
		disabled: t === void 0 || r,
		options: [{
			id: "stable",
			name: c("updates.stable")
		}, {
			id: "nightly",
			name: c("updates.nightly")
		}]
	}, u = {
		id: "version",
		name: c("updates.currentVersion"),
		type: "readOnly",
		value: n ?? null
	};
	return /* @__PURE__ */ v(m, {
		gap: "md",
		padding: "lg",
		maxW: "720px",
		children: [
			/* @__PURE__ */ v(m, {
				gap: "2xs",
				children: [/* @__PURE__ */ _(h, {
					textStyle: "heading/S",
					children: c("updates.title")
				}), /* @__PURE__ */ _(h, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					children: c("updates.description")
				})]
			}),
			i ? /* @__PURE__ */ _(g, {
				status: "error",
				title: i,
				onClose: s
			}) : null,
			/* @__PURE__ */ v(m, {
				gap: "0",
				borderWidth: "1px",
				borderColor: "border.subtle",
				borderRadius: "md",
				py: "xs",
				children: [
					/* @__PURE__ */ _(y, {
						param: l,
						onChange: (e, t) => {
							(t === "stable" || t === "nightly") && o(t);
						}
					}),
					t && /* @__PURE__ */ v(m, {
						gap: "2xs",
						px: "sm",
						pb: "xs",
						children: [/* @__PURE__ */ _(h, {
							textStyle: "label/S/regular",
							color: "fg.muted",
							children: c(t === "nightly" ? "updates.nightlyHelper" : "updates.stableHelper")
						}), t === "nightly" && /* @__PURE__ */ _(h, {
							textStyle: "label/S/regular",
							color: "fg.muted",
							children: c("updates.switchBackNote")
						})]
					}),
					n ? /* @__PURE__ */ _(y, { param: u }) : null
				]
			})
		]
	});
}, C = (t) => {
	let { bridge: r } = t, { t: o } = a("settings"), s = e(), c = n({
		queryKey: b,
		queryFn: () => r.getUpdateChannel()
	}), l = n({
		queryKey: x,
		queryFn: () => r.getAppInfo()
	}), u = i({
		mutationFn: (e) => r.setUpdateChannel(e),
		onMutate: async (e) => {
			await s.cancelQueries({ queryKey: b });
			let t = s.getQueryData(b);
			return s.setQueryData(b, e), { previous: t };
		},
		onError: (e, t, n) => s.setQueryData(b, n?.previous)
	});
	return /* @__PURE__ */ _(S, {
		channel: c.data ?? void 0,
		version: l.data?.version,
		saving: u.isPending,
		error: u.isError ? o("updates.saveError") : void 0,
		onChange: (e) => u.mutate(e),
		onDismissError: () => u.reset()
	});
}, w = (e) => !!(e && typeof e == "object" && "getUpdateChannel" in e && typeof e.getUpdateChannel == "function"), T = "update-channel", E = "dashboard.settings.update-channel", D = (e = globalThis.promptStudioDesktop) => ({
	id: "dashboard.updates",
	activate(t) {
		if (!w(e)) return;
		let n = !1, r = [];
		return e.getUpdateChannel().then((i) => {
			n || i === null || (r = [t.views.registerView({
				id: E,
				title: "Update channel",
				body: {
					kind: "react",
					render: () => /* @__PURE__ */ _(C, { bridge: e })
				}
			}), t.settings.registerPanel({
				kind: "view",
				id: T,
				title: "Update channel",
				section: "workbench",
				scope: "global",
				order: 30,
				icon: "CloudDownload",
				viewId: E
			})]);
		}).catch(() => {}), { dispose: () => {
			n = !0;
			for (let e of r) e.dispose();
		} };
	}
}), O = {
	title: "Settings/Update channel",
	component: S,
	args: {
		version: "0.41.0",
		onChange: () => void 0,
		onDismissError: () => void 0
	}
}, k = { args: { channel: "stable" } }, A = { args: {
	channel: "nightly",
	version: "0.42.0-nightly.20261011"
} }, j = { args: {
	channel: void 0,
	version: void 0
} }, M = { args: {
	channel: "nightly",
	saving: !0
} }, N = { args: {
	channel: "stable",
	error: "Could not change the update channel."
} }, P = () => {
	let e = "stable";
	return {
		getAppInfo: async () => ({ version: "0.41.0" }),
		getUpdateChannel: async () => e,
		setUpdateChannel: async (t) => {
			e = t;
		}
	};
}, F = () => {
	let [e] = f(() => {
		let e = new r({ defaultOptions: { queries: { staleTime: Infinity } } });
		return e.setQueryData(["settings"], null), l({
			max_concurrent_sessions: null,
			notifications_enabled: !1,
			machine_tokens_enabled: !1
		}), e;
	}), [n] = f(() => {
		let e = o(), t = P();
		return e.registerModule(u()), e.registerModule(d(e.settings)), e.registerModule(D(t)), t.getUpdateChannel().then(() => e.commands.executeCommand(c, { panelId: "update-channel" })), e;
	});
	return /* @__PURE__ */ _(t, {
		client: e,
		children: /* @__PURE__ */ _(p, {
			h: "100dvh",
			w: "full",
			children: /* @__PURE__ */ _(s, { workbench: n })
		})
	});
}, I = {
	parameters: { layout: "fullscreen" },
	render: () => /* @__PURE__ */ _(F, {})
};
export { j as Loading, A as Nightly, N as SaveFailure, M as Saving, I as SettingsNavigation, k as Stable, O as default };
