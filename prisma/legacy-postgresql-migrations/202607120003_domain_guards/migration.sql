CREATE OR REPLACE FUNCTION "public"."guard_asset_status_transition"() RETURNS trigger AS $$
BEGIN
  IF NEW."status" = OLD."status" THEN RETURN NEW; END IF;
  IF NOT (
    (OLD."status" = 'AVAILABLE' AND NEW."status" IN ('ALLOCATED','RESERVED','UNDER_MAINTENANCE','LOST','RETIRED')) OR
    (OLD."status" = 'ALLOCATED' AND NEW."status" IN ('AVAILABLE','UNDER_MAINTENANCE','LOST')) OR
    (OLD."status" = 'RESERVED' AND NEW."status" IN ('AVAILABLE','UNDER_MAINTENANCE')) OR
    (OLD."status" = 'UNDER_MAINTENANCE' AND NEW."status" IN ('AVAILABLE','ALLOCATED','RETIRED')) OR
    (OLD."status" = 'LOST' AND NEW."status" IN ('AVAILABLE','RETIRED')) OR
    (OLD."status" = 'RETIRED' AND NEW."status" IN ('AVAILABLE','DISPOSED'))
  ) THEN RAISE EXCEPTION 'invalid asset lifecycle transition: % -> %', OLD."status", NEW."status" USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "asset_status_transition_guard" BEFORE UPDATE OF "status" ON "public"."Asset" FOR EACH ROW EXECUTE FUNCTION "public"."guard_asset_status_transition"();

CREATE OR REPLACE FUNCTION "public"."guard_allocation_holder"() RETURNS trigger AS $$
BEGIN
  IF (NEW."employeeId" IS NULL) = (NEW."departmentId" IS NULL) THEN RAISE EXCEPTION 'allocation requires exactly one holder' USING ERRCODE = '23514'; END IF;
  IF NEW."employeeId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."Employee" WHERE "id"=NEW."employeeId" AND "status"='ACTIVE') THEN RAISE EXCEPTION 'inactive employee cannot receive allocation' USING ERRCODE = '23514'; END IF;
  IF NEW."departmentId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "public"."Department" WHERE "id"=NEW."departmentId" AND "status"='ACTIVE') THEN RAISE EXCEPTION 'inactive department cannot receive allocation' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "allocation_holder_guard" BEFORE INSERT OR UPDATE OF "employeeId","departmentId" ON "public"."Allocation" FOR EACH ROW EXECUTE FUNCTION "public"."guard_allocation_holder"();

CREATE OR REPLACE FUNCTION "public"."guard_closed_audit_line"() RETURNS trigger AS $$
DECLARE cycle_id uuid;
BEGIN
  cycle_id := COALESCE(NEW."auditId", OLD."auditId");
  IF EXISTS (SELECT 1 FROM "public"."AuditCycle" WHERE "id"=cycle_id AND "status"='CLOSED') THEN RAISE EXCEPTION 'closed audit lines are immutable' USING ERRCODE = '23514'; END IF;
  RETURN COALESCE(NEW, OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "closed_audit_line_guard" BEFORE UPDATE OR DELETE ON "public"."AuditLine" FOR EACH ROW EXECUTE FUNCTION "public"."guard_closed_audit_line"();

CREATE OR REPLACE FUNCTION "public"."guard_completed_return"() RETURNS trigger AS $$
BEGIN
  IF OLD."status"='ACCEPTED' AND NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'accepted returns are immutable' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "completed_return_guard" BEFORE UPDATE ON "public"."ReturnRequest" FOR EACH ROW EXECUTE FUNCTION "public"."guard_completed_return"();
