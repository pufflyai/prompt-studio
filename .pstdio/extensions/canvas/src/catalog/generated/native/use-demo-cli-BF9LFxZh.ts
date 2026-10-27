// @ts-nocheck
// Generated from source components; regenerate with build-native-previews.ts.
import { t as e } from "./demo-cli-commands-D1MXwSgH.ts";
import { useEffect as t, useRef as n } from "react";
// clients/landing-page/src/hooks/use-demo-cli.ts
var r = (r, i) => {
	let a = n(null);
	return t(() => {
		let t = a.current, n = (e) => {
			let t = e.detail;
			t.tool === r && i(t);
		};
		return t.addEventListener(e, n), () => t.removeEventListener(e, n);
	}, [r, i]), a;
};
export { r as t };
