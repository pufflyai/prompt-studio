// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { Box as e } from "@chakra-ui/react";
import { jsx as t } from "react/jsx-runtime";
// packages/ui/src/components/primitives/drop-indicator.tsx
var n = (n) => {
	let { orientation: r = "horizontal", ...i } = n;
	return /* @__PURE__ */ t(e, {
		"aria-hidden": !0,
		layerStyle: "dropIndicator",
		...r === "vertical" ? {
			insetY: "0",
			w: "drop-indicator"
		} : {
			insetX: "0",
			h: "drop-indicator"
		},
		...i
	});
};
export { n as t };
