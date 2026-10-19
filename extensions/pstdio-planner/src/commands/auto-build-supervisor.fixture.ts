import { fixture } from "./auto-build.fixture";
import { createSessionResource } from "./session.fixture";
import { sessionQuery } from "./session-query.fixture";

export async function supervisorFixture(limit = 2) {
  const result = await fixture(limit);
  const sessions = new Map<string, ReturnType<typeof createSessionResource>>();
  const prompts: { sessionId: string; prompt?: string }[] = [];
  result.ctx.sessions.create = async (input) => {
    const session = createSessionResource({
      type: "session" as const,
      id: `supervisor-${sessions.size}`,
      title: input.title,
      status: "in_progress" as const,
      last_request_started: new Date().toISOString(),
    });
    sessions.set(session.id, session);
    prompts.push({ sessionId: session.id, prompt: input.prompt });
    return session;
  };
  result.ctx.sessions.get = async (id) => sessions.get(id) ?? null;
  result.ctx.sessions.query = sessionQuery(async () => [...sessions.values()] as never);
  result.ctx.sessions.followup = async (input) => {
    prompts.push(input);
    sessions.get(input.sessionId)!.status = "in_progress";
    sessions.get(input.sessionId)!.last_request_started = new Date().toISOString();
  };
  return { ...result, sessions, prompts };
}
