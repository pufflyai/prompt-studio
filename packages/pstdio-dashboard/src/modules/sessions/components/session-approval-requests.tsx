import { Button, HStack, Stack, Text } from "@chakra-ui/react";
import { AlertMessage, ScrollArea } from "@pstdio/ui";
import type { ApprovalInput, ApprovalRequest } from "pstdio-api-contracts";
import { useState } from "react";
import { getApiClient } from "@/lib/api";

interface SessionApprovalRequestsProps {
  sessionId: string;
  requests: ApprovalRequest[];
  disabled?: boolean;
  onRespond?: (response: ApprovalInput) => Promise<void>;
}
interface ApprovalNoticeProps {
  request: ApprovalRequest;
  disabled: boolean;
  respond(response: ApprovalInput): Promise<void>;
}

const ApprovalNotice = (props: ApprovalNoticeProps) => {
  const { request, disabled, respond } = props;
  const [pending, setPending] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async (decision: ApprovalInput["decision"]) => {
    setPending(true);
    setError(undefined);
    try {
      await respond({ id: request.id, decision });
      setAccepted(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not send the approval response.");
    } finally {
      setPending(false);
    }
  };
  if (accepted) return null;
  return (
    <AlertMessage
      status="warning"
      title={`${request.toolName} needs approval`}
      endElement={
        <HStack gap="xs">
          <Button size="xs" variant="outline" disabled={disabled || pending} onClick={() => void submit("deny")}>
            Deny
          </Button>
          <Button size="xs" disabled={disabled || pending} loading={pending} onClick={() => void submit("approve")}>
            Approve
          </Button>
        </HStack>
      }
    >
      <ScrollArea maxH="xs">
        <Text whiteSpace="pre-wrap" textStyle="label/S/regular" fontFamily="mono">
          {JSON.stringify(request.toolInput, null, 2)}
        </Text>
      </ScrollArea>
      {error ? (
        <Text color="fg.error" role="alert">
          {error}
        </Text>
      ) : null}
    </AlertMessage>
  );
};

export const SessionApprovalRequests = (props: SessionApprovalRequestsProps) => {
  const { sessionId, requests, disabled = false, onRespond } = props;
  return (
    <Stack gap="xs" pb={requests.length ? "sm" : "0"}>
      {requests.map((request) => (
        <ApprovalNotice
          key={`${sessionId}:${request.id}`}
          request={request}
          disabled={disabled}
          respond={onRespond ?? ((response) => getApiClient().sessions.approve(sessionId, response))}
        />
      ))}
    </Stack>
  );
};
