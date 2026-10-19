import { expect, test } from "bun:test";
import { createRelayBackupWorker } from "./worker";

test("equivalent endpoint URLs cannot reuse the live bucket for backups", () => {
  const live = { bucket: "content", s3: { endpoint: "http://objects:80" } };
  expect(() =>
    createRelayBackupWorker({
      databaseUrl: "postgres://unused",
      live,
      backup: { ...live, s3: { endpoint: "http://objects/" } },
    }),
  ).toThrow("separate private bucket");
});
