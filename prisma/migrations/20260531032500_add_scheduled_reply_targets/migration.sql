-- AlterTable
ALTER TABLE "ScheduledPost" ADD COLUMN "interactionSuggestionId" TEXT;
ALTER TABLE "ScheduledPost" ADD COLUMN "replyToPostId" TEXT;
ALTER TABLE "ScheduledPost" ADD COLUMN "quotePostId" TEXT;

-- CreateIndex
CREATE INDEX "ScheduledPost_interactionSuggestionId_idx" ON "ScheduledPost"("interactionSuggestionId");

-- AddForeignKey
ALTER TABLE "ScheduledPost" ADD CONSTRAINT "ScheduledPost_interactionSuggestionId_fkey" FOREIGN KEY ("interactionSuggestionId") REFERENCES "InteractionSuggestion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
