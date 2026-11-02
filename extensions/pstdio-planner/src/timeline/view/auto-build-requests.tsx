import type { AutoBuildButtonProps } from "./auto-build-button";
import { RequestsPanel } from "./requests-panel";

interface AutoBuildRequestsProps
  extends Pick<
    AutoBuildButtonProps,
    "reviewRequests" | "requestErrors" | "onAnswerRequest" | "onOpenRequestChat" | "t"
  > {}

export function AutoBuildRequests(props: AutoBuildRequestsProps) {
  const { reviewRequests = [], requestErrors = [], onAnswerRequest, onOpenRequestChat } = props;
  return (
    <RequestsPanel
      row={{ requests: reviewRequests, requestErrors }}
      heading={false}
      pendingOnly
      onAnswer={async (id, response) => {
        if (!onAnswerRequest) throw new Error("Answering requests is unavailable.");
        return onAnswerRequest(id, response);
      }}
      onOpenChat={async (id) => {
        if (!onOpenRequestChat) throw new Error("Opening a session is unavailable.");
        return onOpenRequestChat(id);
      }}
    />
  );
}
