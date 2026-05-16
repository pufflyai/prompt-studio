"use strict";

const getReleaseLine = async (changeset) => {
  const [firstLine, ...rest] = changeset.summary.split("\n").map((line) => line.trimEnd());
  const prefix = changeset.commit ? `${changeset.commit}: ` : "";
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
