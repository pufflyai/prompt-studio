import type { NativeDocumentSource } from "../../native-document-source";
import type { ExtensionContextBase } from "./context";
import type { ContributionDefinition } from "./contribution-identity";
import type { JsonObject } from "./json";
import type { ParamObjectSchema, ParamsOf } from "./params";
import type { ResourceRef } from "./resources";

export interface TextDocumentRef {
  /** Local to the extension supplying this reference. */
  sourceId: string;
  params: JsonObject;
  resource?: ResourceRef;
}

export interface TextSourceResolution {
  source: NativeDocumentSource;
  content: string;
  editable: boolean;
}

export interface TextSourceDefinition<Schema extends ParamObjectSchema = ParamObjectSchema>
  extends ContributionDefinition<"text-source"> {
  params: Schema;
  resolve(
    ctx: ExtensionContextBase,
    input: { params: ParamsOf<Schema>; resource?: ResourceRef },
  ): TextSourceResolution | Promise<TextSourceResolution>;
  /** Apply the complete text and domain effects. The host may retry an interrupted projection. */
  project(
    ctx: ExtensionContextBase,
    input: { params: ParamsOf<Schema>; resource?: ResourceRef; content: string },
  ): unknown | Promise<unknown>;
}

export interface TextFilePresentation {
  textDocument?: TextDocumentRef;
}
