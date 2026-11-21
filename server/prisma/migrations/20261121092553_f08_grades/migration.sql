-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "gradesReleasedAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "Grade" (
    "id" SERIAL NOT NULL,
    "milestoneId" INTEGER NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "gradedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Grade_milestoneId_key" ON "Grade"("milestoneId");

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- F-08 (BR-11): score range backstop; added by hand.
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_score_range" CHECK ("score" >= 0 AND "score" <= 100);
