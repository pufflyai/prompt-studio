import { connectPsx } from "./database";
import { createPackageObjects } from "./objects";
import { createPsx } from "./service";

const required = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`PSX requires ${key}`);
  return value;
};
const connection = connectPsx(required("DATABASE_URL"));
const objects = await createPackageObjects({
  endpoint: required("S3_ENDPOINT"),
  region: required("S3_REGION"),
  bucket: required("S3_BUCKET"),
  accessKeyId: required("S3_ACCESS_KEY_ID"),
  secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
});
const server = Bun.serve({
  hostname: process.env.PSX_HOST ?? "0.0.0.0",
  port: Number(process.env.PSX_PORT ?? 8080),
  maxRequestBodySize: 64 * 1024 * 1024,
  fetch: createPsx({ database: connection.db, objects, publishToken: required("PSX_PUBLISH_TOKEN") }),
});
const stop = async () => {
  await server.stop();
  objects.close();
  await connection.close();
};
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
