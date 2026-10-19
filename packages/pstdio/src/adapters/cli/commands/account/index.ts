import { defineCommandGroup } from "../../command-group";
import * as connectCommand from "./connect";
import * as loginCommand from "./login";
import {
  createCommand,
  environmentsCommand,
  revokeCommand,
  signOutCommand,
  statusCommand,
  workbenchesCommand,
} from "./owner-commands";

export const { command, describe, subcommands, builder, handler } = defineCommandGroup(
  { name: "account", describe: "Sign in and enroll local workbenches for synchronization" },
  loginCommand,
  statusCommand,
  signOutCommand,
  createCommand,
  workbenchesCommand,
  connectCommand,
  environmentsCommand,
  revokeCommand,
);
