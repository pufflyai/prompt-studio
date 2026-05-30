"use strict";

const SHORT_HASH_LENGTH = 7;

const shortenCommit = (commit) => {
  if (!commit) return "";
  return /^[0-9a-f]{40}$/i.test(commit) ? commit.slice(0, SHORT_HASH_LENGTH) : commit;
};

const getReleaseLine = async (changeset) => {
  const [firstLine, ...rest] = changeset.summary.split("\n").map((line) => line.trimEnd());
  const shortCommit = shortenCommit(changeset.commit);
  const prefix = shortCommit ? `${shortCommit}: ` : "";
  const head = `- ${prefix}${firstLine}`;
  if (rest.length === 0) return head;
  return `${head}\n${rest.map((line) => `  ${line}`).join("\n")}`;
};

const getDependencyReleaseLine = async (_changesets, dependenciesUpdated) => {
  if (dependenciesUpdated.length === 0) return "";
  const list = dependenciesUpdated.map((dep) => `\`${dep.name}@${dep.newVersion}\``).join(", ");
  return `- Updated internal dependencies: ${list}`;
};

module.exports = { getReleaseLine, getDependencyReleaseLine };
module.exports.default = module.exports;
