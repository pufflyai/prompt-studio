import { timingSafeEqual } from "node:crypto";

const tokenMatches = (candidate: string | undefined, expected: string) => {
  if (!candidate) return false;
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return candidateBytes.length === expectedBytes.length && timingSafeEqual(candidateBytes, expectedBytes);
};

const bearerToken = (request: Request) => {
  const authorization = request.headers.get("authorization");
  if (!authorization || !/^bearer\s+/i.test(authorization)) return undefined;
  return authorization.replace(/^bearer\s+/i, "").trim();
};

export const isRuntimeBearerAuthorized = (request: Request, token: string) => tokenMatches(bearerToken(request), token);
