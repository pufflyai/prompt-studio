import type { PGlite } from "@electric-sql/pglite";

// Counts from the November 25 upgrade. Every identity and payload below is synthetic.
export const storageScale = {
  projects: 6,
  documents: 628_492,
  updates: 79_996,
  retries: 169_894,
  records: 337_379,
  operations: 538_976,
  transfers: 398_882,
  resourceDocuments: 89_267,
} as const;

export const seedReleasedStorage = async (db: PGlite) => {
  const { projects, documents, updates, retries, records, operations, transfers, resourceDocuments } = storageScale;
  await db.exec(`CREATE TEMP VIEW upgrade_projects AS SELECT n,CASE WHEN n=0 THEN 'upgrade-repro' ELSE 'fixture-'||n END AS id
    FROM generate_series(0,${projects - 1}) n;
    INSERT INTO projects(id,name,shorthand,created_at,updated_at) SELECT id,'Fixture '||n,'F'||n,'2026-11-20','2026-11-20' FROM upgrade_projects WHERE n>0;
    INSERT INTO storage_ordered_owners(workbench_id,extension_id,epoch) SELECT id,'fixture.records','released' FROM upgrade_projects;
    INSERT INTO storage_documents(workbench_id,extension_id,document_id,state)
      SELECT id,'fixture.records','records',decode('0000','hex') FROM upgrade_projects;
    INSERT INTO storage_record_projections(workbench_id,extension_id,document_id,revision,live_count)
      SELECT id,'fixture.records','records',1,(${records}+n)/${projects} FROM upgrade_projects;`);
  const populate = async (count: number, statement: string) => {
    for (let start = 1; start <= count; start += 5000) {
      const end = Math.min(start + 4999, count);
      await db.exec(`WITH page AS (SELECT i,p.id AS project,'id-'||i AS key
        FROM generate_series(${start},${end}) i JOIN upgrade_projects p ON p.n=i % ${projects})
        ${statement}`);
    }
  };
  await populate(
    operations,
    `INSERT INTO storage_ordered_operations(workbench_id,extension_id,operation_id,fingerprint)
    SELECT project,'fixture.records',key,'fingerprint-'||i FROM page`,
  );
  await populate(
    operations,
    `INSERT INTO storage_ordered_receipts(workbench_id,extension_id,epoch,operation_id,admission_fingerprint,state,indexed)
    SELECT project,'fixture.records','released',key,'admission-'||i,'accepted',true FROM page`,
  );
  await populate(
    operations,
    `INSERT INTO storage_documents(workbench_id,extension_id,document_id,state,revision,folded_revision)
    SELECT project,'fixture.records','["ordered-dependency","'||key||'"]',convert_to('{"epoch":"released"}','UTF8'),1,1 FROM page`,
  );
  const remaining = documents - operations - projects;
  const documentKey = `CASE WHEN i<=${resourceDocuments} THEN '["resource","'||key||'"]' ELSE 'shared-'||key END`;
  await populate(
    remaining,
    `INSERT INTO storage_documents(workbench_id,extension_id,document_id,state,revision,folded_revision)
    SELECT project,'fixture.records',${documentKey},decode('0000','hex'),CASE WHEN i<=${updates} THEN 2 ELSE 1 END,1 FROM page`,
  );
  await populate(
    updates,
    `INSERT INTO storage_document_updates(workbench_id,extension_id,document_id,revision,"update")
    SELECT project,'fixture.records',${documentKey},2,decode('0000','hex') FROM page`,
  );
  // More than one retry is retained for some document heads.
  await populate(
    retries,
    `INSERT INTO storage_document_operations(workbench_id,extension_id,document_id,operation_id,fingerprint)
    SELECT p.id,'fixture.records',CASE WHEN d<=${resourceDocuments} THEN '["resource","id-'||d||'"]' ELSE 'shared-id-'||d END,
      'retry-'||i,'fingerprint-'||i FROM page CROSS JOIN LATERAL (SELECT 1+(i-1)%${remaining} AS d) doc
      JOIN upgrade_projects p ON p.n=d % ${projects}`,
  );
  const value = "jsonb_build_object('body',repeat(md5(i::text),32))";
  await populate(
    records,
    `INSERT INTO storage_current_records(workbench_id,extension_id,record_id,deleted,value,query_values,revision,record_lifetime)
    SELECT project,'fixture.records',key,false,${value},'{}'::jsonb,'1','initial' FROM page`,
  );
  await populate(
    records,
    `INSERT INTO storage_ordered_records(workbench_id,extension_id,record_id,state)
    SELECT project,'fixture.records',key,convert_to(jsonb_build_object('recordId',key,'value',jsonb_build_object('value',${value}),
      'deleted',false,'lifetime','initial','stamps','{}'::jsonb)::text,'UTF8') FROM page`,
  );
  await populate(
    transfers,
    `INSERT INTO asset_transfers(project_id,extension_id,operation_id,expected,created_at)
    SELECT project,'fixture.records',key,jsonb_build_object('sha256',repeat(md5(i::text),2),'mediaType','text/plain','byteLength',i),'2026-11-20T12:00:00Z' FROM page`,
  );
};
