import { apiError, createResultsClient, type ResultsContext } from "../download-artifact-by-id/results.mts";
import { request, type TransferOptions } from "../download-artifact-by-id/transfer.mts";

export const listArtifactInventory = async (options: TransferOptions, results: ResultsContext, names: string[]) => {
  const client = createResultsClient(options, results);
  const required = new Set(names);
  const listed = (await client.list()).filter((artifact) => required.has(artifact.name));
  const artifacts = await Promise.all(
    listed.map(async (artifact) => {
      const id = Number(artifact.id);
      if (!/^[1-9]\d*$/.test(artifact.id) || !Number.isSafeInteger(id))
        throw new Error(`Invalid artifact ID for ${artifact.name}`);
      // Results doesn't list an expiration timestamp. Check that storage still serves the archive.
      const url = await client.signedUrl(artifact);
      const response = await request(options, url, { headers: { Range: "bytes=0-0" } });
      const expired = response.status === 404 || response.status === 410;
      if (!expired && !response.ok)
        throw new Error(`Cannot verify artifact ${artifact.name}: ${await apiError(response)}`);
      await response.body?.cancel();
      return { id, name: artifact.name, digest: artifact.digest ?? "", expired };
    }),
  );
  // Keep the same shape as the paginated inventory used for previous runs.
  return [{ artifacts }];
};
