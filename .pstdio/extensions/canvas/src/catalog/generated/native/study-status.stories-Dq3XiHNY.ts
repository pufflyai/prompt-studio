// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Text as e } from "@chakra-ui/react";
import { jsx as t } from "react/jsx-runtime";
// .pstdio/extensions/motion-lab/src/study-status.stories.tsx
var n = {
	title: "Motion Lab/Study status",
	component: (n) => {
		let { message: r } = n;
		return /* @__PURE__ */ t(e, {
			role: "alert",
			color: "fg.error",
			p: "sm",
			whiteSpace: "pre-wrap",
			children: r
		});
	}
}, r = { args: { message: "This study was deleted or does not exist." } }, i = { args: { message: "duration: Must be greater than zero\nmarkers.0.at: Markers must be sorted and before the end" } }, a = { args: { message: "scene.tsx:3:12: \"unavailable-library\" is not available to Motion Lab scenes" } };
export { a as BuildError, r as Deleted, i as InvalidMetadata, n as default };
