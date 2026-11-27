DROP INDEX "documents_room_of";--> statement-breakpoint
CREATE INDEX "documents_room_parent" ON "documents" USING btree ("owner_id","room_of") WHERE "documents"."room_of" IS NOT NULL;