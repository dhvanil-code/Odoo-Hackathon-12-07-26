-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateEnum
CREATE TYPE "public"."RoleName" AS ENUM ('ADMIN', 'ASSET_MANAGER', 'DEPARTMENT_HEAD', 'EMPLOYEE', 'AUDITOR');

-- CreateEnum
CREATE TYPE "public"."RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."AssetStatus" AS ENUM ('AVAILABLE', 'ALLOCATED', 'RESERVED', 'UNDER_MAINTENANCE', 'LOST', 'RETIRED', 'DISPOSED');

-- CreateEnum
CREATE TYPE "public"."AssetCondition" AS ENUM ('NEW', 'EXCELLENT', 'GOOD', 'FAIR', 'DAMAGED', 'UNUSABLE');

-- CreateEnum
CREATE TYPE "public"."AllocationStatus" AS ENUM ('ACTIVE', 'RETURNED', 'TRANSFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."TransferStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ReturnStatus" AS ENUM ('REQUESTED', 'INSPECTION', 'ACCEPTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."MaintenanceStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'TECHNICIAN_ASSIGNED', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "public"."AuditStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'REVIEW', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."AuditResult" AS ENUM ('PENDING', 'VERIFIED', 'MISSING', 'DAMAGED');

-- CreateEnum
CREATE TYPE "public"."DiscrepancyStatus" AS ENUM ('OPEN', 'CONFIRMED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "public"."Severity" AS ENUM ('INFO', 'SUCCESS', 'WARNING', 'ERROR');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" UUID NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMPTZ(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."Role" (
    "id" UUID NOT NULL,
    "name" "public"."RoleName" NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserRole" (
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedById" UUID,
    "reason" TEXT,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "public"."Employee" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "employeeNumber" TEXT,
    "name" TEXT NOT NULL,
    "departmentId" UUID,
    "managerId" UUID,
    "phone" TEXT,
    "joiningDate" DATE,
    "status" "public"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Department" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "parentId" UUID,
    "headId" UUID,
    "status" "public"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssetCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "AssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CategoryAttributeDefinition" (
    "id" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "options" JSONB,

    CONSTRAINT "CategoryAttributeDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Location" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "status" "public"."RecordStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Asset" (
    "id" UUID NOT NULL,
    "tag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serialNumber" TEXT,
    "categoryId" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "owningDepartmentId" UUID,
    "acquisitionDate" DATE,
    "acquisitionCost" DECIMAL(12,2),
    "condition" "public"."AssetCondition" NOT NULL DEFAULT 'GOOD',
    "status" "public"."AssetStatus" NOT NULL DEFAULT 'AVAILABLE',
    "manufacturer" TEXT,
    "model" TEXT,
    "warrantyExpiry" DATE,
    "notes" TEXT,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "customAttributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssetAttachment" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssetHistory" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "previousStatus" "public"."AssetStatus",
    "newStatus" "public"."AssetStatus" NOT NULL,
    "actorId" UUID,
    "reason" TEXT NOT NULL,
    "relatedType" TEXT,
    "relatedId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Allocation" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "employeeId" UUID,
    "departmentId" UUID,
    "status" "public"."AllocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "allocationDate" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReturnDate" TIMESTAMPTZ(3),
    "actualReturnDate" TIMESTAMPTZ(3),
    "purpose" TEXT NOT NULL,
    "conditionAtIssue" "public"."AssetCondition" NOT NULL,
    "accessories" TEXT,
    "notes" TEXT,
    "overdue" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Allocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TransferRequest" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "proposedHolderId" UUID NOT NULL,
    "status" "public"."TransferStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "requiredBy" TIMESTAMPTZ(3),
    "notes" TEXT,
    "approvedById" UUID,
    "approvedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TransferApproval" (
    "id" UUID NOT NULL,
    "transferId" UUID NOT NULL,
    "approverId" UUID NOT NULL,
    "decision" "public"."TransferStatus" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransferApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReturnRequest" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "allocationId" UUID NOT NULL,
    "employeeId" UUID NOT NULL,
    "status" "public"."ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "proposedReturnDate" TIMESTAMPTZ(3),
    "actualReturnDate" TIMESTAMPTZ(3),
    "reportedCondition" "public"."AssetCondition" NOT NULL,
    "verifiedCondition" "public"."AssetCondition",
    "conditionNotes" TEXT,
    "accessoriesReturned" TEXT,
    "missingAccessories" TEXT,
    "newLocationId" UUID,
    "followUpAction" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ResourceBooking" (
    "id" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "bookedById" UUID NOT NULL,
    "departmentId" UUID,
    "startTime" TIMESTAMPTZ(3) NOT NULL,
    "endTime" TIMESTAMPTZ(3) NOT NULL,
    "purpose" TEXT NOT NULL,
    "attendeeCount" INTEGER,
    "notes" TEXT,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'UPCOMING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MaintenanceRequest" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "raisedById" UUID NOT NULL,
    "technicianId" UUID,
    "issueDescription" TEXT NOT NULL,
    "priority" "public"."Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "public"."MaintenanceStatus" NOT NULL DEFAULT 'PENDING',
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,
    "resolutionNotes" TEXT,
    "completionDate" TIMESTAMPTZ(3),
    "finalCondition" "public"."AssetCondition",
    "operationalCost" DECIMAL(12,2),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditCycle" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "departmentId" UUID,
    "locationId" UUID,
    "startDate" TIMESTAMPTZ(3) NOT NULL,
    "endDate" TIMESTAMPTZ(3) NOT NULL,
    "status" "public"."AuditStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditAssignment" (
    "auditId" UUID NOT NULL,
    "auditorId" UUID NOT NULL,

    CONSTRAINT "AuditAssignment_pkey" PRIMARY KEY ("auditId","auditorId")
);

-- CreateTable
CREATE TABLE "public"."AuditLine" (
    "id" UUID NOT NULL,
    "auditId" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "auditorId" UUID,
    "expectedHolder" TEXT,
    "expectedLocation" TEXT NOT NULL,
    "expectedStatus" "public"."AssetStatus" NOT NULL,
    "expectedCondition" "public"."AssetCondition" NOT NULL,
    "result" "public"."AuditResult" NOT NULL DEFAULT 'PENDING',
    "actualLocation" TEXT,
    "actualHolder" TEXT,
    "notes" TEXT,
    "verifiedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AuditLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditDiscrepancy" (
    "id" UUID NOT NULL,
    "auditLineId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "public"."DiscrepancyStatus" NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditDiscrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" UUID NOT NULL,
    "recipientId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "public"."Severity" NOT NULL DEFAULT 'INFO',
    "readAt" TIMESTAMPTZ(3),
    "relatedType" TEXT,
    "relatedId" UUID,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ActivityLog" (
    "id" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "oldValues" JSONB,
    "newValues" JSONB,
    "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
    "reason" TEXT,
    "correlationId" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrganizationSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "OrganizationSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."JobRun" (
    "id" UUID NOT NULL,
    "jobName" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "completedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" JSONB,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "public"."Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "public"."Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeNumber_key" ON "public"."Employee"("employeeNumber");

-- CreateIndex
CREATE INDEX "Employee_departmentId_status_idx" ON "public"."Employee"("departmentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "public"."Department"("code");

-- CreateIndex
CREATE INDEX "Department_status_idx" ON "public"."Department"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AssetCategory_code_key" ON "public"."AssetCategory"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CategoryAttributeDefinition_categoryId_code_key" ON "public"."CategoryAttributeDefinition"("categoryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Location_code_key" ON "public"."Location"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_tag_key" ON "public"."Asset"("tag");

-- CreateIndex
CREATE INDEX "Asset_categoryId_status_idx" ON "public"."Asset"("categoryId", "status");

-- CreateIndex
CREATE INDEX "Asset_locationId_idx" ON "public"."Asset"("locationId");

-- CreateIndex
CREATE INDEX "Asset_serialNumber_idx" ON "public"."Asset"("serialNumber");

-- CreateIndex
CREATE INDEX "AssetHistory_assetId_createdAt_idx" ON "public"."AssetHistory"("assetId", "createdAt");

-- CreateIndex
CREATE INDEX "Allocation_expectedReturnDate_status_idx" ON "public"."Allocation"("expectedReturnDate", "status");

-- CreateIndex
CREATE INDEX "TransferRequest_status_idx" ON "public"."TransferRequest"("status");

-- CreateIndex
CREATE INDEX "ResourceBooking_resourceId_startTime_endTime_idx" ON "public"."ResourceBooking"("resourceId", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_status_priority_idx" ON "public"."MaintenanceRequest"("status", "priority");

-- CreateIndex
CREATE INDEX "AuditCycle_status_idx" ON "public"."AuditCycle"("status");

-- CreateIndex
CREATE INDEX "AuditAssignment_auditorId_idx" ON "public"."AuditAssignment"("auditorId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLine_auditId_assetId_key" ON "public"."AuditLine"("auditId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditDiscrepancy_auditLineId_key" ON "public"."AuditDiscrepancy"("auditLineId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON "public"."Notification"("dedupeKey");

-- CreateIndex
CREATE INDEX "Notification_recipientId_readAt_idx" ON "public"."Notification"("recipientId", "readAt");

-- CreateIndex
CREATE INDEX "ActivityLog_entityType_entityId_createdAt_idx" ON "public"."ActivityLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "JobRun_dedupeKey_key" ON "public"."JobRun"("dedupeKey");

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Department" ADD CONSTRAINT "Department_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Department" ADD CONSTRAINT "Department_headId_fkey" FOREIGN KEY ("headId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CategoryAttributeDefinition" ADD CONSTRAINT "CategoryAttributeDefinition_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."AssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Asset" ADD CONSTRAINT "Asset_owningDepartmentId_fkey" FOREIGN KEY ("owningDepartmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetAttachment" ADD CONSTRAINT "AssetAttachment_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AssetHistory" ADD CONSTRAINT "AssetHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Allocation" ADD CONSTRAINT "Allocation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Allocation" ADD CONSTRAINT "Allocation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Allocation" ADD CONSTRAINT "Allocation_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferRequest" ADD CONSTRAINT "TransferRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferRequest" ADD CONSTRAINT "TransferRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferRequest" ADD CONSTRAINT "TransferRequest_proposedHolderId_fkey" FOREIGN KEY ("proposedHolderId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TransferApproval" ADD CONSTRAINT "TransferApproval_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "public"."TransferRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReturnRequest" ADD CONSTRAINT "ReturnRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReturnRequest" ADD CONSTRAINT "ReturnRequest_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "public"."Allocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReturnRequest" ADD CONSTRAINT "ReturnRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResourceBooking" ADD CONSTRAINT "ResourceBooking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "public"."Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResourceBooking" ADD CONSTRAINT "ResourceBooking_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ResourceBooking" ADD CONSTRAINT "ResourceBooking_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditCycle" ADD CONSTRAINT "AuditCycle_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditCycle" ADD CONSTRAINT "AuditCycle_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "public"."Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditAssignment" ADD CONSTRAINT "AuditAssignment_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "public"."AuditCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditAssignment" ADD CONSTRAINT "AuditAssignment_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLine" ADD CONSTRAINT "AuditLine_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "public"."AuditCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLine" ADD CONSTRAINT "AuditLine_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "public"."Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLine" ADD CONSTRAINT "AuditLine_auditorId_fkey" FOREIGN KEY ("auditorId") REFERENCES "public"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditDiscrepancy" ADD CONSTRAINT "AuditDiscrepancy_auditLineId_fkey" FOREIGN KEY ("auditLineId") REFERENCES "public"."AuditLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "public"."Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Native business invariants that Prisma cannot express.
CREATE EXTENSION IF NOT EXISTS "btree_gist";
CREATE UNIQUE INDEX "one_active_allocation_per_asset" ON "public"."Allocation" ("assetId") WHERE "status" = 'ACTIVE' AND "actualReturnDate" IS NULL;
CREATE UNIQUE INDEX "one_pending_transfer_per_asset" ON "public"."TransferRequest" ("assetId") WHERE "status" IN ('REQUESTED', 'APPROVED');
ALTER TABLE "public"."ResourceBooking" ADD CONSTRAINT "booking_positive_duration" CHECK ("startTime" < "endTime");
ALTER TABLE "public"."ResourceBooking" ADD CONSTRAINT "no_overlapping_active_resource_bookings" EXCLUDE USING gist ("resourceId" WITH =, tstzrange("startTime", "endTime", '[)') WITH &&) WHERE ("status" IN ('UPCOMING', 'ONGOING'));
ALTER TABLE "public"."TransferRequest" ADD CONSTRAINT "transfer_new_holder" CHECK ("requesterId" <> "proposedHolderId");
