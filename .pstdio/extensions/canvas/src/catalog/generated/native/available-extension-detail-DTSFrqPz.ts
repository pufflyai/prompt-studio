// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./arrow-left-DwicprnJ.ts";
import { t } from "./blocks-C5COKy0k.ts";
import { t as n } from "./download-B4RJJThF.ts";
import { t as r } from "./puzzle-BKD3K9Fw.ts";
import { t as i } from "./useTranslation-DvWg4zeU.ts";
import { t as a } from "./extension-contributions-BT7DBR-B.ts";
import { Button as o, Flex as s, HStack as c, Spinner as l, Stack as u, Tabs as d, Text as f } from "@chakra-ui/react";
import { jsx as p, jsxs as m } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/settings/components/available-extension-detail.tsx
var h = (h) => {
	let { extension: g, metadata: _, contributionsError: v, loadingContributions: y, installing: b, onBack: x, onInstall: S } = h, { t: C } = i("projects"), w = _?.extensions[0]?.id ?? g.registry?.extensionId ?? g.installName, T = g.registry ? `${g.registry.url}/${g.registry.extensionId}` : `${g.origin.url}@${g.origin.ref}#${g.origin.path}`;
	return /* @__PURE__ */ m(u, {
		gap: "md",
		paddingBottom: "lg",
		"data-testid": "available-extension-detail",
		children: [/* @__PURE__ */ m(u, {
			gap: "md",
			paddingX: "lg",
			paddingTop: "lg",
			children: [
				/* @__PURE__ */ p(c, { children: /* @__PURE__ */ m(o, {
					variant: "ghost",
					size: "2xs",
					onClick: x,
					"data-testid": "extension-detail-back",
					children: [/* @__PURE__ */ p(e, { size: 12 }), C("projectSettings.extensionsPanel.detail.back")]
				}) }),
				/* @__PURE__ */ m(c, {
					gap: "md",
					alignItems: "center",
					children: [
						/* @__PURE__ */ p(s, {
							alignItems: "center",
							justifyContent: "center",
							boxSize: "11",
							flexShrink: "0",
							borderWidth: "1px",
							borderColor: "border.subtle",
							borderRadius: "sm",
							bg: "bg.subtle",
							children: /* @__PURE__ */ p(r, { size: 22 })
						}),
						/* @__PURE__ */ m(u, {
							gap: "0",
							flex: "1",
							minW: "0",
							children: [
								/* @__PURE__ */ p(f, {
									textStyle: "heading/M",
									children: g.displayName
								}),
								/* @__PURE__ */ p(f, {
									textStyle: "label/XS",
									fontFamily: "mono",
									color: "fg.subtle",
									children: g.installName
								}),
								/* @__PURE__ */ m(f, {
									textStyle: "label/XS",
									fontFamily: "mono",
									color: "fg.subtle",
									truncate: !0,
									children: [g.publisher ? `${g.publisher} · ` : "", T]
								})
							]
						}),
						/* @__PURE__ */ m(o, {
							variant: "outline",
							size: "2xs",
							loading: b,
							onClick: S,
							"data-testid": "available-extension-install",
							children: [/* @__PURE__ */ p(n, { size: 12 }), C("projectSettings.extensionsPanel.marketplace.install")]
						})
					]
				}),
				/* @__PURE__ */ p(f, {
					textStyle: "paragraph/S/regular",
					color: "fg.muted",
					children: g.description
				})
			]
		}), /* @__PURE__ */ m(d.Root, {
			defaultValue: "contributions",
			size: "sm",
			tray: !0,
			children: [/* @__PURE__ */ p(d.List, { children: /* @__PURE__ */ m(d.Trigger, {
				value: "contributions",
				children: [/* @__PURE__ */ p(t, { size: 14 }), C("projectSettings.extensionsPanel.detail.tabs.contributions")]
			}) }), /* @__PURE__ */ p(d.Content, {
				value: "contributions",
				children: /* @__PURE__ */ m(u, {
					paddingX: "lg",
					children: [
						y && /* @__PURE__ */ p(l, { size: "sm" }),
						!y && v && /* @__PURE__ */ p(f, {
							textStyle: "label/XS",
							color: "fg.muted",
							children: v
						}),
						!y && !v && /* @__PURE__ */ p(a, {
							metadata: _,
							extensionId: w,
							automations: []
						})
					]
				})
			})]
		})]
	});
};
export { h as t };
