-- CreateTable
CREATE TABLE "Feedback" (
    "id" SERIAL NOT NULL,
    "submissionId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "comment" VARCHAR(5000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_submissionId_createdAt_idx" ON "Feedback"("submissionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
