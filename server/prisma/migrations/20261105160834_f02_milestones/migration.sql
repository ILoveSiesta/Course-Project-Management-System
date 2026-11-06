-- CreateTable
CREATE TABLE "Milestone" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000),
    "deadline" TIMESTAMPTZ(3) NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Milestone_teamId_deadline_idx" ON "Milestone"("teamId", "deadline");

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
