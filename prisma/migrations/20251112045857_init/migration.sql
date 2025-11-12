-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "theme" TEXT NOT NULL DEFAULT 'system',
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "defaultModel" TEXT,
    "searchModel" TEXT
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Key" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "hashed_password" TEXT,
    "user_id" TEXT NOT NULL,
    CONSTRAINT "Key_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'New Chat',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "maxTokens" INTEGER NOT NULL DEFAULT 2000,
    "userPrompt" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "providerId" TEXT,
    CONSTRAINT "ModelConfig_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT,
    "isCustom" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "mcp_server_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "command" TEXT,
    "baseUrl" TEXT,
    "apiKey" TEXT,
    "config" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "defaultModel" TEXT,
    "searchModel" TEXT,
    "theme" TEXT,
    "language" TEXT,
    "displayName" TEXT,
    "mcpServerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "user_preferences_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "mcp_server_configs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE INDEX "Key_user_id_idx" ON "Key"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "ModelConfig_name_key" ON "ModelConfig"("name");

-- CreateIndex
CREATE INDEX "ModelConfig_providerId_idx" ON "ModelConfig"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Provider_name_key" ON "Provider"("name");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_server_configs_name_key" ON "mcp_server_configs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");
