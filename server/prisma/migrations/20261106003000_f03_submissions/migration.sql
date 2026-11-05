-- CreateTable
CREATE TABLE "Submission" (
    "id" SERIAL NOT NULL,
    "milestoneId" INTEGER NOT NULL,
    "submittedById" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" VARCHAR(2000),
    "link" VARCHAR(2048) NOT NULL,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "daysLate" INTEGER NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Submission_milestoneId_version_key" ON "Submission"("milestoneId", "version");

-- CreateIndex
CREATE INDEX "Submission_milestoneId_submittedAt_idx" ON "Submission"("milestoneId", "submittedAt");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
