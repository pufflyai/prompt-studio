import { ListMultipartUploadsCommand, ListObjectsV2Command, ListPartsCommand, type S3Client } from "@aws-sdk/client-s3";

export const listObjects = async (client: S3Client) => {
  const listed: { key: string; bytes: number }[] = [];
  let ContinuationToken: string | undefined;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket: "relay", ContinuationToken }));
    for (const object of page.Contents ?? []) listed.push({ key: object.Key!, bytes: object.Size! });
    ContinuationToken = page.NextContinuationToken;
  } while (ContinuationToken);
  return listed;
};

export const listUnfinishedUploads = async (client: S3Client) => {
  const uploads: { key: string; bytes: number }[] = [];
  let KeyMarker: string | undefined;
  let UploadIdMarker: string | undefined;
  do {
    const page = await client.send(new ListMultipartUploadsCommand({ Bucket: "relay", KeyMarker, UploadIdMarker }));
    for (const upload of page.Uploads ?? []) {
      let PartNumberMarker: string | undefined;
      let bytes = 0;
      do {
        const parts = await client.send(
          new ListPartsCommand({ Bucket: "relay", Key: upload.Key, UploadId: upload.UploadId, PartNumberMarker }),
        );
        bytes += (parts.Parts ?? []).reduce((sum, part) => sum + (part.Size ?? 0), 0);
        PartNumberMarker = parts.IsTruncated ? parts.NextPartNumberMarker : undefined;
      } while (PartNumberMarker);
      uploads.push({ key: upload.Key!, bytes });
    }
    KeyMarker = page.IsTruncated ? page.NextKeyMarker : undefined;
    UploadIdMarker = page.NextUploadIdMarker;
  } while (KeyMarker);
  return uploads;
};
