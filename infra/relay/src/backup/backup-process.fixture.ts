import { createRelayBackupWorker } from "./worker";

const worker = createRelayBackupWorker(JSON.parse(process.env.BACKUP_FIXTURE_CONFIG!));
try {
  await worker.tick();
} finally {
  await worker.close();
}
