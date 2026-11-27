import type { CanvasMeta } from "@pstdio/canvas";
import type { ExtensionOAuthStatus } from "@pstdio/sdk/extensions";
import { useState } from "react";
import { ExtensionOAuthConnectionControls } from "./extension-oauth-connection-controls";

export default {
  title: "Product/Settings/Extensions/Browser sign-in",
  component: ExtensionOAuthConnectionControls,
} satisfies CanvasMeta<typeof ExtensionOAuthConnectionControls>;

export const BrowserSignIn = () => {
  const [status, setStatus] = useState<ExtensionOAuthStatus["status"]>("disconnected");
  return (
    <>
      <label>
        Provider state{" "}
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="disconnected">Disconnected</option>
          <option value="authorizing">Authorizing</option>
          <option value="connected">Connected</option>
          <option value="reconnect_required">Reconnect required</option>
        </select>
      </label>
      <ExtensionOAuthConnectionControls
        label="Upsales"
        status={status}
        authorizationUrl={status === "authorizing" ? "#browser-sign-in" : undefined}
        onConnect={() => setStatus("authorizing")}
        onDisconnect={() => setStatus("disconnected")}
      />
    </>
  );
};
