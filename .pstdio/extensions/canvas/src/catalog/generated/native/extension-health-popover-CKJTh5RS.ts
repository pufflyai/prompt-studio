// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./circle-alert-DphG-Ztw.ts";
import { t } from "./circle-arrow-up-C11LjouQ.ts";
import { t as n } from "./copy-COTDVt4R.ts";
import { t as r } from "./triangle-alert-DcqN2fDE.ts";
import { t as i } from "./useTranslation-DvWg4zeU.ts";
import { Button as a, HStack as o, Icon as s, Popover as c, Portal as l, Stack as u, Text as d } from "@chakra-ui/react";
import { toaster as f } from "@pstdio/ui";
import { Fragment as p, jsx as m, jsxs as h } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/settings/components/extension-load-error.ts
var g = (e, t) => {
	let n = e?.[t];
	return typeof n == "string" ? n : void 0;
}, _ = (e) => [g(e, "code"), g(e, "message")].filter(Boolean).join("\n"), v = (v) => {
	let { extension: y, diagnostics: b, unavailableHarnesses: x = [], upgrading: S, onUpgrade: C } = v, { t: w } = i("projects"), T = y.status === "error", E = b.filter((e) => e.severity !== "info"), D = E.length + x.length + +!!T, O = g(y.lastError, "code"), k = O === "extension_manifest_unsupported_api_version" ? w("projectSettings.extensionsPanel.health.incompatibleVersions") : O, A = async () => {
		await navigator.clipboard.writeText(_(y.lastError)), f.create({
			type: "success",
			title: w("projectSettings.extensionsPanel.health.errorCopied")
		});
	};
	if (D === 0) return null;
	let j = T ? "fg.error" : "fg.warning";
	return /* @__PURE__ */ h(c.Root, {
		positioning: { placement: "bottom-end" },
		children: [/* @__PURE__ */ m(c.Trigger, {
			asChild: !0,
			children: /* @__PURE__ */ h(a, {
				variant: "ghost",
				size: "2xs",
				color: j,
				gap: "2xs",
				"data-testid": "extension-health-trigger",
				"aria-label": w("projectSettings.extensionsPanel.health.triggerAriaLabel", { name: y.displayName }),
				children: [/* @__PURE__ */ m(s, {
					boxSize: "3.5",
					children: m(T ? e : r, {})
				}), /* @__PURE__ */ m(d, {
					textStyle: "label/XS",
					fontFamily: "mono",
					children: D
				})]
			})
		}), /* @__PURE__ */ m(l, { children: /* @__PURE__ */ m(c.Positioner, { children: /* @__PURE__ */ m(c.Content, {
			width: "320px",
			"data-testid": "extension-health-popover",
			children: /* @__PURE__ */ m(c.Body, {
				padding: "0",
				children: /* @__PURE__ */ h(u, {
					gap: "0",
					children: [
						/* @__PURE__ */ h(o, {
							paddingX: "md",
							paddingY: "sm",
							borderBottomWidth: "1px",
							borderColor: "border.subtle",
							gap: "xs",
							children: [
								/* @__PURE__ */ m(s, {
									boxSize: "3.5",
									color: j,
									children: m(T ? e : r, {})
								}),
								/* @__PURE__ */ m(d, {
									textStyle: "label/S/medium",
									children: T ? w("projectSettings.extensionsPanel.health.failedToLoad") : w("projectSettings.extensionsPanel.health.issues", { count: D })
								}),
								y.lastLoadedAt && /* @__PURE__ */ m(d, {
									textStyle: "label/XS",
									color: "fg.subtle",
									marginLeft: "auto",
									children: w("projectSettings.extensionsPanel.health.lastLoaded", { time: new Date(y.lastLoadedAt).toLocaleTimeString() })
								})
							]
						}),
						/* @__PURE__ */ h(u, {
							paddingX: "md",
							paddingY: "sm",
							gap: "2xs",
							children: [
								T && /* @__PURE__ */ h(p, { children: [k && /* @__PURE__ */ m(d, {
									textStyle: "label/XS",
									fontFamily: "mono",
									color: "fg.error",
									children: k
								}), /* @__PURE__ */ m(d, {
									textStyle: "label/XS",
									color: "fg.muted",
									children: g(y.lastError, "message") ?? w("projectSettings.extensionsPanel.health.unknownError")
								})] }),
								E.slice(0, 4).map((e, t) => /* @__PURE__ */ h(d, {
									textStyle: "label/XS",
									color: "fg.muted",
									children: [
										e.code,
										": ",
										e.message
									]
								}, `${e.code}-${t}`)),
								x.map((e) => /* @__PURE__ */ h(u, {
									gap: "0",
									minW: "0",
									children: [/* @__PURE__ */ h(d, {
										textStyle: "label/XS",
										color: "fg.muted",
										wordBreak: "break-word",
										children: [e.name, " is unavailable"]
									}), e.availability.reason && /* @__PURE__ */ m(d, {
										textStyle: "label/XS",
										color: "fg.muted",
										whiteSpace: "pre-wrap",
										wordBreak: "break-word",
										children: e.availability.reason
									})]
								}, e.id))
							]
						}),
						T && /* @__PURE__ */ h(o, {
							paddingX: "md",
							paddingY: "sm",
							borderTopWidth: "1px",
							borderColor: "border.subtle",
							gap: "xs",
							children: [y.canUpgrade && C && /* @__PURE__ */ h(a, {
								variant: "primary",
								size: "2xs",
								onClick: C,
								loading: S,
								"data-testid": "extension-health-upgrade",
								children: [/* @__PURE__ */ m(t, { size: 12 }), w("projectSettings.extensionsPanel.upgrade.action")]
							}), /* @__PURE__ */ h(a, {
								variant: "ghost",
								size: "2xs",
								onClick: () => void A(),
								"data-testid": "extension-copy-error",
								children: [/* @__PURE__ */ m(n, { size: 12 }), w("projectSettings.extensionsPanel.health.copyError")]
							})]
						})
					]
				})
			})
		}) }) })]
	});
};
export { _ as n, g as r, v as t };
