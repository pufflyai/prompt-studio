import { startSharedStorybooks } from "./storybook-server";

export default async function globalSetup() {
  return startSharedStorybooks();
}
