-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedById" TEXT,
    "reason" TEXT,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "roleId"),
    CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "employeeNumber" TEXT,
    "name" TEXT NOT NULL,
    "departmentId" TEXT,
    "managerId" TEXT,
    "phone" TEXT,
    "joiningDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "headId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE'
);

-- CreateTable
CREATE TABLE "CategoryAttributeDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,
    CONSTRAINT "CategoryAttributeDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE'
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT,
    "categoryId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "owningDepartmentId" TEXT,
    "acquisitionDate" DATETIME,
    "acquisitionCost" DECIMAL,
    "condition" TEXT NOT NULL DEFAULT 'GOOD',
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "manufacturer" TEXT,
    "model" TEXT,
    "warrantyExpiry" DATETIME,
    "notes" TEXT,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "customAttributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AssetCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Asset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Asset_owningDepartmentId_fkey" FOREIGN KEY ("owningDepartmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetTagSequence" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AssetAttachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetAttachment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssetHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "actorId" TEXT,
    "reason" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssetHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Allocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "employeeId" TEXT,
    "departmentId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "allocationDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnDate" DATETIME,
    "actualReturnDate" DATETIME,
    "purpose" TEXT NOT NULL,
    "conditionAtIssue" TEXT NOT NULL,
    "accessories" TEXT,
    "notes" TEXT,
    "overdue" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Allocation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Allocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Allocation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransferRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "proposedHolderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "requiredBy" DATETIME,
    "notes" TEXT,
    "approvedById" TEXT,
    "approvedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransferRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "TransferRequest_proposedHolderId_fkey" FOREIGN KEY ("proposedHolderId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransferApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transferId" TEXT NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TransferApproval_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "TransferRequest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "proposedReturnDate" DATETIME,
    "actualReturnDate" DATETIME,
    "reportedCondition" TEXT NOT NULL,
    "verifiedCondition" TEXT,
    "conditionNotes" TEXT,
    "accessoriesReturned" TEXT,
    "missingAccessories" TEXT,
    "newLocationId" TEXT,
    "followUpAction" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReturnRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReturnRequest_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "Allocation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReturnRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResourceBooking" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceId" TEXT NOT NULL,
    "bookedById" TEXT NOT NULL,
    "departmentId" TEXT,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "purpose" TEXT NOT NULL,
    "attendeeCount" INTEGER,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UPCOMING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResourceBooking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResourceBooking_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResourceBooking_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assetId" TEXT NOT NULL,
    "raisedById" TEXT NOT NULL,
    "technicianId" TEXT,
    "issueDescription" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,
    "resolutionNotes" TEXT,
    "completionDate" DATETIME,
    "finalCondition" TEXT,
    "operationalCost" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MaintenanceRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MaintenanceRequest_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditCycle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "departmentId" TEXT,
    "locationId" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditCycle_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditCycle_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditAssignment" (
    "auditId" TEXT NOT NULL,
    "auditorId" TEXT NOT NULL,

    PRIMARY KEY ("auditId", "auditorId"),
    CONSTRAINT "AuditAssignment_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "AuditCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditAssignment_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "auditorId" TEXT,
    "expectedHolder" TEXT,
    "expectedLocation" TEXT NOT NULL,
    "expectedStatus" TEXT NOT NULL,
    "expectedCondition" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "actualLocation" TEXT,
    "actualHolder" TEXT,
    "notes" TEXT,
    "verifiedAt" DATETIME,
    CONSTRAINT "AuditLine_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "AuditCycle" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLine_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditLine_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "Employee" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditDiscrepancy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "auditLineId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditDiscrepancy_auditLineId_fkey" FOREIGN KEY ("auditLineId") REFERENCES "AuditLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "readAt" DATETIME,
    "relatedType" TEXT,
    "relatedId" TEXT,
    "dedupeKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Employee" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
    "reason" TEXT,
    "correlationId" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "OrganizationSetting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" JSONB NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobName" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "completedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" JSONB
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "Employee"("employeeNumber");

-- CreateIndex
CREATE INDEX "Employee_departmentId_status_idx" ON "Employee"("departmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE INDEX "Department_status_idx" ON "Department"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_code_key" ON "AssetCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryAttributeDefinition_categoryId_code_key" ON "CategoryAttributeDefinition"("categoryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "Location"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_tag_key" ON "Asset"("tag");

-- CreateIndex
CREATE INDEX "Asset_categoryId_status_idx" ON "Asset"("categoryId", "status");

-- CreateIndex
CREATE INDEX "Asset_locationId_idx" ON "Asset"("locationId");

-- CreateIndex
CREATE INDEX "Asset_serialNumber_idx" ON "Asset"("serialNumber");

-- CreateIndex
CREATE INDEX "AssetHistory_assetId_createdAt_idx" ON "AssetHistory"("assetId", "createdAt");

-- CreateIndex
CREATE INDEX "Allocation_expectedReturnDate_status_idx" ON "Allocation"("expectedReturnDate", "status");

-- CreateIndex
CREATE INDEX "TransferRequest_status_idx" ON "TransferRequest"("status");

-- CreateIndex
CREATE INDEX "ResourceBooking_resourceId_startTime_endTime_idx" ON "ResourceBooking"("resourceId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_status_priority_idx" ON "MaintenanceRequest"("status", "priority");

-- CreateIndex
CREATE INDEX "AuditCycle_status_idx" ON "AuditCycle"("status");

-- CreateIndex
CREATE INDEX "AuditAssignment_auditorId_idx" ON "AuditAssignment"("auditorId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLine_auditId_assetId_key" ON "AuditLine"("auditId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditDiscrepancy_auditLineId_key" ON "AuditDiscrepancy"("auditLineId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_idx" ON "Notification"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_createdAt_idx" ON "ActivityLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobRun_dedupeKey_key" ON "JobRun"("dedupeKey");

-- SQLite business invariants not expressible in Prisma schema.
CREATE UNIQUE INDEX "one_active_allocation_per_asset"
  ON "Allocation"("assetId")
  WHERE "status" = 'ACTIVE' AND "actualReturnDate" IS NULL;

CREATE UNIQUE INDEX "one_pending_transfer_per_asset"
  ON "TransferRequest"("assetId")
  WHERE "status" IN ('REQUESTED', 'APPROVED');

CREATE TRIGGER "allocation_holder_insert_guard"
BEFORE INSERT ON "Allocation"
BEGIN
  SELECT RAISE(ABORT, 'allocation requires exactly one holder')
  WHERE (NEW."employeeId" IS NULL AND NEW."departmentId" IS NULL)
     OR (NEW."employeeId" IS NOT NULL AND NEW."departmentId" IS NOT NULL);
  SELECT RAISE(ABORT, 'inactive employee cannot receive allocation')
  WHERE NEW."employeeId" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "Employee" WHERE "id" = NEW."employeeId" AND "status" = 'ACTIVE');
  SELECT RAISE(ABORT, 'inactive department cannot receive allocation')
  WHERE NEW."departmentId" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "Department" WHERE "id" = NEW."departmentId" AND "status" = 'ACTIVE');
END;

CREATE TRIGGER "resource_booking_insert_guard"
BEFORE INSERT ON "ResourceBooking"
BEGIN
  SELECT RAISE(ABORT, 'booking start must precede end')
  WHERE NEW."startTime" >= NEW."endTime";
  SELECT RAISE(ABORT, 'resource booking overlap')
  WHERE NEW."status" IN ('UPCOMING', 'ONGOING')
    AND EXISTS (
      SELECT 1 FROM "ResourceBooking"
      WHERE "resourceId" = NEW."resourceId"
        AND "status" IN ('UPCOMING', 'ONGOING')
        AND "startTime" < NEW."endTime"
        AND "endTime" > NEW."startTime"
    );
END;

CREATE TRIGGER "resource_booking_update_guard"
BEFORE UPDATE OF "resourceId", "startTime", "endTime", "status" ON "ResourceBooking"
BEGIN
  SELECT RAISE(ABORT, 'booking start must precede end')
  WHERE NEW."startTime" >= NEW."endTime";
  SELECT RAISE(ABORT, 'resource booking overlap')
  WHERE NEW."status" IN ('UPCOMING', 'ONGOING')
    AND EXISTS (
      SELECT 1 FROM "ResourceBooking"
      WHERE "id" <> NEW."id"
        AND "resourceId" = NEW."resourceId"
        AND "status" IN ('UPCOMING', 'ONGOING')
        AND "startTime" < NEW."endTime"
        AND "endTime" > NEW."startTime"
    );
END;

CREATE TRIGGER "asset_status_transition_guard"
BEFORE UPDATE OF "status" ON "Asset"
WHEN NEW."status" <> OLD."status"
BEGIN
  SELECT RAISE(ABORT, 'invalid asset lifecycle transition')
  WHERE NOT (
    (OLD."status" = 'AVAILABLE' AND NEW."status" IN ('ALLOCATED', 'RESERVED', 'UNDER_MAINTENANCE', 'LOST', 'RETIRED')) OR
    (OLD."status" = 'ALLOCATED' AND NEW."status" IN ('AVAILABLE', 'UNDER_MAINTENANCE', 'LOST')) OR
    (OLD."status" = 'RESERVED' AND NEW."status" IN ('AVAILABLE', 'UNDER_MAINTENANCE')) OR
    (OLD."status" = 'UNDER_MAINTENANCE' AND NEW."status" IN ('AVAILABLE', 'ALLOCATED', 'RETIRED')) OR
    (OLD."status" = 'LOST' AND NEW."status" IN ('AVAILABLE', 'RETIRED')) OR
    (OLD."status" = 'RETIRED' AND NEW."status" IN ('AVAILABLE', 'DISPOSED'))
  );
END;

CREATE TRIGGER "closed_audit_line_update_guard"
BEFORE UPDATE ON "AuditLine"
WHEN EXISTS (SELECT 1 FROM "AuditCycle" WHERE "id" = OLD."auditId" AND "status" = 'CLOSED')
BEGIN SELECT RAISE(ABORT, 'closed audit lines are immutable'); END;

CREATE TRIGGER "closed_audit_line_delete_guard"
BEFORE DELETE ON "AuditLine"
WHEN EXISTS (SELECT 1 FROM "AuditCycle" WHERE "id" = OLD."auditId" AND "status" = 'CLOSED')
BEGIN SELECT RAISE(ABORT, 'closed audit lines are immutable'); END;

CREATE TRIGGER "completed_return_guard"
BEFORE UPDATE ON "ReturnRequest"
WHEN OLD."status" = 'ACCEPTED'
BEGIN SELECT RAISE(ABORT, 'accepted returns are immutable'); END;
