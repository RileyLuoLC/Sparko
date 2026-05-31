-- CreateTable
CREATE TABLE "RoleInputTemplate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "example" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleInputTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyRoleInput" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "xAccountId" TEXT NOT NULL,
    "roleInputTemplateId" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "evidenceUrl" TEXT,
    "weekOf" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyRoleInput_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleInputTemplate_workspaceId_roleName_contentType_key" ON "RoleInputTemplate"("workspaceId", "roleName", "contentType");

-- CreateIndex
CREATE INDEX "RoleInputTemplate_workspaceId_updatedAt_idx" ON "RoleInputTemplate"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "WeeklyRoleInput_workspaceId_weekOf_idx" ON "WeeklyRoleInput"("workspaceId", "weekOf");

-- CreateIndex
CREATE INDEX "WeeklyRoleInput_xAccountId_weekOf_idx" ON "WeeklyRoleInput"("xAccountId", "weekOf");

-- AddForeignKey
ALTER TABLE "RoleInputTemplate" ADD CONSTRAINT "RoleInputTemplate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyRoleInput" ADD CONSTRAINT "WeeklyRoleInput_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyRoleInput" ADD CONSTRAINT "WeeklyRoleInput_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "XAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
