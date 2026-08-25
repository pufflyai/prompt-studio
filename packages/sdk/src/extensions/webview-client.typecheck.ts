import { defineCommand } from "./define-command";
import type { GuestHost } from "./define-extension-view";
import { params } from "./params";
import { createWebviewClient } from "./webview-client";

const readTicketStatuses = defineCommand({
  title: "Read ticket statuses",
  async run() {
    return { statuses: [{ id: "todo", name: "Todo" }] };
  },
});

const createTicketStatus = defineCommand({
  title: "Create ticket status",
  params: {
    label: params.text({ required: true }),
    color: params.text(),
  },
  async run(ctx) {
    return { id: ctx.params.label };
  },
});

const commands = {
  "ticketStatus.read": readTicketStatuses,
  "ticketStatus.create": createTicketStatus,
};

const settings = {
  properties: {
    "counter.enabled": {
      type: "boolean",
      scope: "project",
      default: true,
    },
    "counter.step": {
      type: "number",
      scope: "project",
      default: 1,
    },
  },
} as const;

declare const host: GuestHost;
const client = createWebviewClient<typeof commands, typeof settings>(host);

// Command results keep the type of the command's run handler.
const statuses: Promise<{ statuses: { id: string; name: string }[] }> = client.commands["ticketStatus.read"]();
void statuses;

// Command params come from the command's params schema.
const created: Promise<{ id: string }> = client.commands["ticketStatus.create"]({ label: "Todo" });
void created;

// @ts-expect-error unknown command keys are rejected
client.commands["missing.command"]();

// @ts-expect-error params must match the command schema
client.commands["ticketStatus.create"]({ label: 42 });

// @ts-expect-error required params cannot be omitted
client.commands["ticketStatus.create"]({ color: "red" });

// @ts-expect-error commands with required params need a params argument
client.commands["ticketStatus.create"]();

// Settings are typed by the settings contribution.
const enabled: Promise<boolean | undefined> = client.settings.get("counter.enabled");
void enabled;

const all: Promise<{ "counter.enabled"?: boolean; "counter.step"?: number }> = client.settings.all();
void all;

// @ts-expect-error unknown setting keys are rejected
client.settings.get("counter.missing");

// @ts-expect-error setting values must match the declared setting type
client.settings.set("counter.step", "large");

// Without a settings source the settings client accepts no keys.
const bareClient = createWebviewClient<typeof commands>(host);

// @ts-expect-error settings keys are untyped without a settings source
bareClient.settings.get("counter.enabled");
