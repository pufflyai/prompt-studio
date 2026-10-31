#!/usr/bin/env bun
import { runCli } from "../src/project/cli";

process.exitCode = await runCli(process.argv.slice(2));
