// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./useTranslation-DvWg4zeU.ts";
import { Button as t, Dialog as n, HStack as r, Input as i, Stack as a, Text as o } from "@chakra-ui/react";
import { Radio as s, RadioGroup as c } from "@pstdio/ui";
import { Fragment as l, jsx as u, jsxs as d } from "react/jsx-runtime";
// packages/pstdio-dashboard/src/modules/projects/components/project-folder-choice.tsx
var f = (f) => {
	let { projectName: p, gitRemote: m, method: h, clonePath: g, pending: _, error: v, onMethodChange: y, onClonePathChange: b, onBrowse: x, onNotNow: S, onContinue: C } = f, { t: w } = e("projects"), T = h === "clone";
	return /* @__PURE__ */ d(l, { children: [
		/* @__PURE__ */ d(n.Header, {
			flexDirection: "column",
			alignItems: "stretch",
			gap: "2xs",
			children: [/* @__PURE__ */ u(n.Title, { children: w("folder.title", { name: p }) }), /* @__PURE__ */ u(n.Description, {
				textStyle: "paragraph/S/regular",
				color: "fg.muted",
				children: w("folder.description")
			})]
		}),
		/* @__PURE__ */ d(n.Body, { children: [/* @__PURE__ */ u(c, {
			value: h,
			onValueChange: (e) => y(e.value),
			children: /* @__PURE__ */ d(a, {
				gap: "sm",
				children: [m ? /* @__PURE__ */ d(a, {
					layerStyle: "optionCard",
					gap: "xs",
					children: [/* @__PURE__ */ u(s, {
						value: "clone",
						children: w("folder.clone", { remote: m })
					}), /* @__PURE__ */ d(r, {
						gap: "xs",
						ps: "lg",
						children: [/* @__PURE__ */ u(i, {
							size: "xs",
							"aria-label": w("folder.clonePath"),
							value: g,
							disabled: !T,
							onChange: (e) => b(e.target.value)
						}), /* @__PURE__ */ u(t, {
							variant: "outline",
							size: "xs",
							disabled: !T,
							onClick: x,
							children: w("folder.browse")
						})]
					})]
				}) : null, /* @__PURE__ */ d(a, {
					layerStyle: "optionCard",
					gap: "2xs",
					children: [/* @__PURE__ */ u(s, {
						value: "existing",
						children: w("folder.existing")
					}), /* @__PURE__ */ u(o, {
						textStyle: "label/S/regular",
						color: "fg.subtle",
						children: w(m ? "folder.existingHint" : "folder.existingHintNoRemote")
					})]
				})]
			})
		}), v ? /* @__PURE__ */ u(o, {
			role: "alert",
			mt: "sm",
			textStyle: "paragraph/S/regular",
			color: "fg.error",
			children: v
		}) : null] }),
		/* @__PURE__ */ d(n.Footer, {
			gap: "xs",
			children: [/* @__PURE__ */ u(t, {
				variant: "outline",
				size: "sm",
				onClick: S,
				children: w("folder.notNow")
			}), /* @__PURE__ */ u(t, {
				variant: "primary",
				size: "sm",
				loading: _,
				disabled: T && !g.trim(),
				onClick: C,
				children: w(T ? "folder.cloneAndContinue" : "folder.chooseFolder")
			})]
		})
	] });
};
export { f as t };
