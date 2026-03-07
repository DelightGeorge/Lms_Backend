-- CreateEnum
CREATE TYPE "InstructorAppStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'INSTRUCTOR_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'INSTRUCTOR_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'INSTRUCTOR_APPLICATION';

-- CreateTable
CREATE TABLE "InstructorApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "expertise" TEXT NOT NULL,
    "yearsExperience" INTEGER NOT NULL,
    "bio" TEXT NOT NULL,
    "idDocumentUrl" TEXT NOT NULL,
    "cvUrl" TEXT NOT NULL,
    "portfolioUrl" TEXT,
    "sampleVideoUrl" TEXT,
    "teachingMotivation" TEXT NOT NULL,
    "status" "InstructorAppStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstructorApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstructorApplication_userId_key" ON "InstructorApplication"("userId");

-- AddForeignKey
ALTER TABLE "InstructorApplication" ADD CONSTRAINT "InstructorApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstructorApplication" ADD CONSTRAINT "InstructorApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
