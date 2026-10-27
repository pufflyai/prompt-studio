// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./workbench-core-N58OeDyx.ts";
import { Code as t, Stack as n, Text as r } from "@chakra-ui/react";
import { jsx as i, jsxs as a } from "react/jsx-runtime";
// packages/pstdio-workbench/src/examples/onboarding/core/views.tsx
var o = () => {
	let o = e();
	return o.registerModule({
		id: "host.guide",
		activate(e) {
			e.views.registerView({
				id: "host.guide",
				title: "Guide",
				body: {
					kind: "react",
					render: ({ instance: e }) => /* @__PURE__ */ a(n, {
						h: "full",
						gap: "sm",
						p: "lg",
						bg: "bg",
						children: [
							/* @__PURE__ */ i(r, {
								textStyle: "heading/M/semibold",
								children: e.title
							}),
							/* @__PURE__ */ i(r, {
								color: "fg.muted",
								children: "A View owns this trusted React content."
							}),
							/* @__PURE__ */ i(r, {
								color: "fg.muted",
								children: "The Instance details View to the right is registered once and placed twice. Close it in the Side Panel, then reopen it from that region's add menu. The Secondary Panel copy starts closed."
							})
						]
					})
				}
			}), e.views.registerView({
				id: "host.instance-info",
				title: "Instance details",
				body: {
					kind: "react",
					render: ({ instance: e }) => /* @__PURE__ */ a(n, {
						h: "full",
						gap: "sm",
						p: "lg",
						bg: "bg",
						children: [
							/* @__PURE__ */ i(r, {
								textStyle: "heading/S/semibold",
								children: e.title
							}),
							/* @__PURE__ */ a(r, {
								color: "fg.muted",
								children: ["Placement owner: ", /* @__PURE__ */ i(t, { children: e.placementIdentity?.kind ?? "none" })]
							}),
							/* @__PURE__ */ a(r, {
								color: "fg.muted",
								children: ["Instance key: ", /* @__PURE__ */ i(t, { children: e.placementIdentity?.instanceKey ?? "default" })]
							})
						]
					})
				}
			}), e.shellPlacements.registerPlacement({
				id: "host.guide",
				item: {
					kind: "view",
					presence: "fixed",
					view: {
						kind: "view",
						id: "host.guide"
					}
				},
				region: "main"
			}), e.shellPlacements.registerPlacement({
				id: "host.instance-info.side",
				item: {
					kind: "view",
					presence: "open",
					view: {
						kind: "view",
						id: "host.instance-info"
					}
				},
				region: "side"
			}), e.shellPlacements.registerPlacement({
				id: "host.instance-info.secondary",
				item: {
					kind: "view",
					presence: "closed",
					view: {
						kind: "view",
						id: "host.instance-info"
					}
				},
				region: "secondary"
			});
		}
	}), o;
};
export { o as t };
