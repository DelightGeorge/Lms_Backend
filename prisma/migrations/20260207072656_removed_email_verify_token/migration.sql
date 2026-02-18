/*
  Warnings:

  - You are about to drop the column `emailVerifyExpires` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerifyToken` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailVerifyExpires",
DROP COLUMN "emailVerifyToken",
ADD COLUMN     "emailVerificationToken" TEXT;
