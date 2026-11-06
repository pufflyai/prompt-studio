import { Box } from "@chakra-ui/react";
import type { CanvasMeta } from "@pstdio/canvas";
import { SessionApprovalRequests } from "./session-approval-requests";

const requests = [{ id: "approval", toolName: "shell", toolInput: { command: "bun test" }, toolUseId: "shell-call" }];
export default {
  title: "Modules/Sessions/Approvals",
  description: "Synthetic approval responses. Offline approvals remain readable with unavailable actions.",
} satisfies CanvasMeta;

export const Pending = () => (
  <Box w="2xl" p="sm">
    <SessionApprovalRequests sessionId="preview" requests={requests} onRespond={async () => {}} />
  </Box>
);
export const Offline = () => (
  <Box w="2xl" p="sm">
    <SessionApprovalRequests sessionId="preview" requests={requests} disabled onRespond={async () => {}} />
  </Box>
);
export const ResponseFailure = () => (
  <Box w="2xl" p="sm">
    <SessionApprovalRequests
      sessionId="preview"
      requests={requests}
      onRespond={async () => {
        throw new Error("Laptop is unavailable. Reconnect it and try again.");
      }}
    />
  </Box>
);
