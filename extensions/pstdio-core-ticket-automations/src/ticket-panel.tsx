import "@pstdio/ui/style.css";

import { Button, HStack, Input, Stack, Text, Textarea } from "@chakra-ui/react";
import { defineExtensionView, type GuestHost } from "@pstdio/sdk/extensions";
import { AlertMessage, ChakraProvider, psTheme } from "@pstdio/ui";
import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";

interface CommandResponse {
  outcome: {
    ok: boolean;
    reason?: string;
    status: "success" | "rejected" | "error";
    value?: unknown;
  };
}

interface TicketCommandValue {
  stderr?: string;
  stdout?: string;
}

interface TicketAutomationPanelProps {
  host: GuestHost;
}

const commandIds = {
  list: "pstdio-core-ticket-automations.tickets.list",
  pull: "pstdio-core-ticket-automations.tickets.pull",
  runAttempt: "pstdio-core-ticket-automations.runAttempt",
  save: "pstdio-core-ticket-automations.tickets.save",
};

const executeCommand = async (host: GuestHost, commandId: string, params?: Record<string, unknown>) => {
  const response = await host.call<CommandResponse>("commands.execute", { commandId, params });
  if (response.outcome.status !== "success") {
    throw new Error(response.outcome.reason ?? "Ticket command failed.");
  }
  return response.outcome.value;
};

const formatValue = (value: unknown) => {
  if (!value) return "Done.";
  if (typeof value !== "object") return String(value);

  const output = value as TicketCommandValue;
  const text = [output.stdout, output.stderr].filter(Boolean).join("\n").trim();
  return text || JSON.stringify(value, null, 2);
};

const TicketAutomationPanel = (props: TicketAutomationPanelProps) => {
  const { host } = props;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState("");
  const [ticket, setTicket] = useState("");

  const runAction = async (label: string, commandId: string, params?: Record<string, unknown>) => {
    setBusy(label);
    setError(null);
    try {
      const value = await executeCommand(host, commandId, params);
      setOutput(formatValue(value));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const trimmedTicket = ticket.trim();

  return (
    <Stack boxSizing="border-box" minH="100%" p="lg" gap="lg" bg="bg" color="fg">
      <Text textStyle="heading/M">Ticket automation</Text>

      {error ? (
        <AlertMessage status="error" colorPalette="red" title="Command failed" size="sm">
          {error}
        </AlertMessage>
      ) : null}

      <Stack gap="sm" maxW="720px">
        <Input value={ticket} onChange={(event) => setTicket(event.target.value)} placeholder="PS-123" />
        <HStack gap="sm" flexWrap="wrap">
          <Button
            size="sm"
            loading={busy === "List"}
            onClick={() => runAction("List", commandIds.list, { archived: false })}
          >
            List tickets
          </Button>
          <Button size="sm" loading={busy === "Pull"} onClick={() => runAction("Pull", commandIds.pull)}>
            Pull tickets
          </Button>
          <Button
            size="sm"
            disabled={!trimmedTicket}
            loading={busy === "Save"}
            onClick={() => runAction("Save", commandIds.save, { id: trimmedTicket })}
          >
            Save ticket
          </Button>
          <Button
            size="sm"
            disabled={!trimmedTicket}
            loading={busy === "Run attempt"}
            onClick={() => runAction("Run attempt", commandIds.runAttempt, { ticket: trimmedTicket })}
          >
            Run attempt
          </Button>
        </HStack>
      </Stack>

      <Textarea readOnly value={output} minH="260px" fontFamily="mono" placeholder="Command output" />
    </Stack>
  );
};

export default defineExtensionView({
  render({ mount, host }) {
    const root = createRoot(mount);
    root.render(
      <StrictMode>
        <ChakraProvider value={psTheme}>
          <TicketAutomationPanel host={host} />
        </ChakraProvider>
      </StrictMode>,
    );
  },
});
