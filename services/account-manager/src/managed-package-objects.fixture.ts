import { CreateBucketCommand, DeleteBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { createManagedPackageObjects } from "./managed-package-objects";

export const createManagedPackageObjectFixture = async () => {
  const endpoint = process.env.MANAGER_TEST_S3_ENDPOINT;
  if (!endpoint) throw new Error("Run managed package integration through test:integration");
  const config = {
    endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: "manager_fixture", secretAccessKey: "manager_fixture_secret_only" },
  };
  const bucket = `managed-${crypto.randomUUID()}`;
  const client = new S3Client(config);
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  const objects = createManagedPackageObjects(bucket, config);
  const ids = new Set<string>();
  return {
    bucket,
    client,
    config,
    objects: {
      ...objects,
      reserve: (id: string) => {
        ids.add(id);
        return objects.reserve(id);
      },
      // Authentication can close its client before fixture cleanup.
      close: () => {},
    },
    close: async () => {
      try {
        for (const id of ids) await objects.remove(id);
        await client.send(new DeleteBucketCommand({ Bucket: bucket }));
      } finally {
        objects.close();
        client.destroy();
      }
    },
  };
};
