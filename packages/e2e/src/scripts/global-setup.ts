import { primeBunCache } from "./prime-bun-cache";

export default async function globalSetup() {
  primeBunCache();
}
