-- Add model preference fields to User model
ALTER TABLE "User" ADD COLUMN "defaultModel" TEXT;
ALTER TABLE "User" ADD COLUMN "searchModel" TEXT;
