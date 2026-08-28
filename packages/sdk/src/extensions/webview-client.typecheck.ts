import type { WebviewArtifactFile } from "pstdio-api-contracts/extension-kernel";
import { defineCommand } from "./define-command";
import { defineArtifactMount } from "./define-contribution";
import type { GuestHost } from "./define-extension-view";
import { params } from "./params";
import { createWebviewClient } from "./webview-client";

const readTicketStatuses = defineCommand({
  id: "ticketStatus.read",
  title: "Read ticket statuses",
  async run(_ctx, _commandParams) {
    return { statuses: [{ id: "todo", name: "Todo" }] };
  },
});

const createTicketStatus = defineCommand({
  id: "ticketStatus.create",
  title: "Create ticket status",
  params: {
    label: params.text({ required: true }),
    color: params.text(),
  },
  async run(_ctx, commandParams) {
    return { id: commandParams.label };
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

// Artifact reads accept the mount contribution, its ref, or the local id.
const runArtifacts = defineArtifactMount({ id: "runs", path: "runs", label: "Runs" });
const files: Promise<WebviewArtifactFile[]> = client.artifacts.list(runArtifacts, "a/");
void files;
const text: Promise<string> = client.artifacts.readText(runArtifacts.ref, "a/summary.json");
void text;
const imageUrl: Promise<string> = client.artifacts.imageUrl("runs", "a/chart.png");
void imageUrl;

// @ts-expect-error artifact reads need a path
client.artifacts.readText(runArtifacts);

// Without a settings source the settings client accepts no keys.
const bareClient = createWebviewClient<typeof commands>(host);

// @ts-expect-error settings keys are untyped without a settings source
bareClient.settings.get("counter.enabled");
