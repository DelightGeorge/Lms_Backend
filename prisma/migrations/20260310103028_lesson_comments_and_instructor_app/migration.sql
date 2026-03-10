/*
  Warnings:

  - The values [INSTRUCTOR_REJECTED,INSTRUCTOR_APPROVED,INSTRUCTOR_APPLICATION] on the enum `NotificationType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('ENROLLMENT', 'PAYMENT', 'COURSE_PUBLISHED', 'COURSE_APPROVED', 'COURSE_REJECTED', 'COURSE_COMPLETED', 'NEW_LESSON', 'QUIZ_RESULT', 'ACCOUNT', 'GENERAL', 'REVIEW', 'PAYMENT_RECEIVED', 'PAYOUT_REQUESTED', 'PAYOUT_APPROVED', 'PAYOUT_REJECTED', 'REFUND');
ALTER TABLE "Notification" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "NotificationType_old";
COMMIT;

-- CreateTable
CREATE TABLE "LessonComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LessonComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LessonCommentLike" (
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "LessonCommentLike_userId_commentId_key" ON "LessonCommentLike"("userId", "commentId");

-- AddForeignKey
ALTER TABLE "LessonComment" ADD CONSTRAINT "LessonComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonComment" ADD CONSTRAINT "LessonComment_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonComment" ADD CONSTRAINT "LessonComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "LessonComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCommentLike" ADD CONSTRAINT "LessonCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonCommentLike" ADD CONSTRAINT "LessonCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "LessonComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
