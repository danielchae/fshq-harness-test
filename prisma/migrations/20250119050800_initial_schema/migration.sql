-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('sleeper', 'espn', 'yahoo');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "JoinRule" AS ENUM ('auto_join', 'approval_required');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('commissioner', 'admin', 'manager', 'fan');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "MomentType" AS ENUM ('post', 'trade', 'rankings', 'prediction', 'matchResult', 'transaction', 'pickems');

-- CreateEnum
CREATE TYPE "PowerRankingStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "MatchupType" AS ENUM ('regular_season', 'playoff', 'toilet_bowl');

-- CreateEnum
CREATE TYPE "MatchupPredictionStatus" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('trade', 'add', 'drop', 'waiver');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "password" VARCHAR(255),
    "name" VARCHAR(255),
    "username" VARCHAR(50),
    "image" VARCHAR(2048),
    "avatarUrl" VARCHAR(2048),
    "preferences" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "platform" "Platform" NOT NULL DEFAULT 'sleeper',
    "platformLeagueId" VARCHAR(255),
    "teamCount" INTEGER NOT NULL DEFAULT 0,
    "season" INTEGER NOT NULL,
    "scoringFormat" VARCHAR(50),
    "playoffStructure" VARCHAR(50),
    "isDynasty" BOOLEAN NOT NULL DEFAULT false,
    "avatarUrl" VARCHAR(2048),
    "visibility" "Visibility" NOT NULL DEFAULT 'private',
    "joinRule" "JoinRule" NOT NULL DEFAULT 'approval_required',
    "creatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "ownerUsername" VARCHAR(100),
    "sleeperUsername" VARCHAR(100),
    "managerId" TEXT,
    "externalRosterId" VARCHAR(255),
    "avatarUrl" VARCHAR(2048),
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "ties" INTEGER NOT NULL DEFAULT 0,
    "pointsScored" DECIMAL(10,2),
    "currentSeason" INTEGER,
    "stableFantasyUserId" VARCHAR(255),
    "isClaimed" BOOLEAN NOT NULL DEFAULT false,
    "claimedBy" TEXT,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'fan',
    "status" "MembershipStatus" NOT NULL DEFAULT 'pending',
    "teamId" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueSettings" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "pickemsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "powerRankingsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bracketEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fanAccessEnabled" BOOLEAN NOT NULL DEFAULT true,
    "fanLimit" INTEGER,
    "currentFanCount" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "publicContent" JSONB NOT NULL DEFAULT '{"rankings": true, "matchups": true, "brackets": true, "transactions": false, "history": true}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeagueSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Slug" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(255) NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Slug_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Moment" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "type" "MomentType" NOT NULL DEFAULT 'post',
    "content" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "pinnedById" TEXT,
    "hiddenById" TEXT,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Moment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "momentId" TEXT NOT NULL,
    "parentId" TEXT,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "momentId" TEXT NOT NULL,
    "reactionType" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PowerRanking" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "status" "PowerRankingStatus" NOT NULL DEFAULT 'draft',
    "publishedByUserId" TEXT,
    "isSkipped" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PowerRanking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PowerRankingEntry" (
    "id" TEXT NOT NULL,
    "powerRankingId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "previousRank" INTEGER,
    "movement" INTEGER,
    "commentary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PowerRankingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Matchup" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "homeTeamScore" DECIMAL(10,2),
    "awayTeamScore" DECIMAL(10,2),
    "homeTeamProjected" DECIMAL(10,2),
    "awayTeamProjected" DECIMAL(10,2),
    "winnerId" TEXT,
    "isComplete" BOOLEAN NOT NULL DEFAULT false,
    "matchupType" "MatchupType" NOT NULL DEFAULT 'regular_season',
    "externalMatchupId" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Matchup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchupPrediction" (
    "id" TEXT NOT NULL,
    "matchupId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "predictedWinnerId" TEXT NOT NULL,
    "hypeText" TEXT,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "status" "MatchupPredictionStatus" NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "isCorrect" BOOLEAN,
    "gradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchupPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PickemEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "matchupId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "season" INTEGER NOT NULL,
    "predictedWinnerId" TEXT NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isCorrect" BOOLEAN,
    "pointsEarned" INTEGER NOT NULL DEFAULT 0,
    "hasStatCorrection" BOOLEAN NOT NULL DEFAULT false,
    "previousIsCorrect" BOOLEAN,
    "gradedAt" TIMESTAMP(3),
    "regradedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PickemEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "season" INTEGER NOT NULL DEFAULT 2025,
    "weekNumber" INTEGER NOT NULL,
    "totalPicks" INTEGER NOT NULL DEFAULT 0,
    "correctPicks" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "season" INTEGER NOT NULL,
    "totalPicks" INTEGER NOT NULL DEFAULT 0,
    "correctPicks" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "perfectWeeks" INTEGER NOT NULL DEFAULT 0,
    "bestWeekAccuracy" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllTimeStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "totalPicks" INTEGER NOT NULL DEFAULT 0,
    "correctPicks" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "seasonsPlayed" INTEGER NOT NULL DEFAULT 0,
    "bestSeasonAccuracy" DOUBLE PRECISION,
    "perfectWeeksTotal" INTEGER NOT NULL DEFAULT 0,
    "championshipWins" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AllTimeStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "type" "TransactionType" NOT NULL,
    "teamId" TEXT NOT NULL,
    "playerName" VARCHAR(255) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "faabAmount" INTEGER,
    "tradePartnerTeamId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeasonHistory" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "champion" VARCHAR(255) NOT NULL,
    "runnerUp" VARCHAR(255) NOT NULL,
    "totalMembers" INTEGER NOT NULL,
    "championshipScore" VARCHAR(50),
    "thirdPlace" VARCHAR(255),
    "regularSeasonWinner" VARCHAR(255),
    "seasonSummary" TEXT,
    "dynastyContinuityData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeasonHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EngagementMetrics" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "momentsCreated" INTEGER NOT NULL DEFAULT 0,
    "commentsCount" INTEGER NOT NULL DEFAULT 0,
    "reactionsCount" INTEGER NOT NULL DEFAULT 0,
    "uniqueActiveUsers" INTEGER,
    "peakDailyActivity" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EngagementMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "League_slug_key" ON "League"("slug");

-- CreateIndex
CREATE INDEX "League_slug_idx" ON "League"("slug");

-- CreateIndex
CREATE INDEX "League_creatorId_idx" ON "League"("creatorId");

-- CreateIndex
CREATE INDEX "League_platformLeagueId_idx" ON "League"("platformLeagueId");

-- CreateIndex
CREATE UNIQUE INDEX "League_platform_platformLeagueId_key" ON "League"("platform", "platformLeagueId");

-- CreateIndex
CREATE INDEX "Team_leagueId_idx" ON "Team"("leagueId");

-- CreateIndex
CREATE INDEX "Team_externalRosterId_idx" ON "Team"("externalRosterId");

-- CreateIndex
CREATE INDEX "Team_managerId_idx" ON "Team"("managerId");

-- CreateIndex
CREATE INDEX "Team_claimedBy_idx" ON "Team"("claimedBy");

-- CreateIndex
CREATE UNIQUE INDEX "Team_leagueId_externalRosterId_key" ON "Team"("leagueId", "externalRosterId");

-- CreateIndex
CREATE INDEX "LeagueMembership_userId_idx" ON "LeagueMembership"("userId");

-- CreateIndex
CREATE INDEX "LeagueMembership_leagueId_idx" ON "LeagueMembership"("leagueId");

-- CreateIndex
CREATE INDEX "LeagueMembership_userId_leagueId_idx" ON "LeagueMembership"("userId", "leagueId");

-- CreateIndex
CREATE INDEX "LeagueMembership_leagueId_status_idx" ON "LeagueMembership"("leagueId", "status");

-- CreateIndex
CREATE INDEX "LeagueMembership_leagueId_role_idx" ON "LeagueMembership"("leagueId", "role");

-- CreateIndex
CREATE INDEX "LeagueMembership_leagueId_userId_role_idx" ON "LeagueMembership"("leagueId", "userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMembership_userId_leagueId_key" ON "LeagueMembership"("userId", "leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueSettings_leagueId_key" ON "LeagueSettings"("leagueId");

-- CreateIndex
CREATE INDEX "LeagueSettings_leagueId_idx" ON "LeagueSettings"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "Slug_slug_key" ON "Slug"("slug");

-- CreateIndex
CREATE INDEX "Slug_slug_idx" ON "Slug"("slug");

-- CreateIndex
CREATE INDEX "Slug_entityType_entityId_idx" ON "Slug"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Slug_createdById_idx" ON "Slug"("createdById");

-- CreateIndex
CREATE INDEX "Moment_leagueId_idx" ON "Moment"("leagueId");

-- CreateIndex
CREATE INDEX "Moment_authorId_idx" ON "Moment"("authorId");

-- CreateIndex
CREATE INDEX "Moment_leagueId_createdAt_idx" ON "Moment"("leagueId", "createdAt");

-- CreateIndex
CREATE INDEX "Moment_leagueId_lastActivityAt_idx" ON "Moment"("leagueId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "Moment_leagueId_isPinned_idx" ON "Moment"("leagueId", "isPinned");

-- CreateIndex
CREATE INDEX "Moment_type_idx" ON "Moment"("type");

-- CreateIndex
CREATE INDEX "Comment_momentId_idx" ON "Comment"("momentId");

-- CreateIndex
CREATE INDEX "Comment_authorId_idx" ON "Comment"("authorId");

-- CreateIndex
CREATE INDEX "Comment_momentId_createdAt_idx" ON "Comment"("momentId", "createdAt");

-- CreateIndex
CREATE INDEX "Comment_parentId_idx" ON "Comment"("parentId");

-- CreateIndex
CREATE INDEX "Reaction_momentId_idx" ON "Reaction"("momentId");

-- CreateIndex
CREATE INDEX "Reaction_userId_idx" ON "Reaction"("userId");

-- CreateIndex
CREATE INDEX "Reaction_momentId_reactionType_idx" ON "Reaction"("momentId", "reactionType");

-- CreateIndex
CREATE UNIQUE INDEX "Reaction_userId_momentId_reactionType_key" ON "Reaction"("userId", "momentId", "reactionType");

-- CreateIndex
CREATE INDEX "PowerRanking_leagueId_idx" ON "PowerRanking"("leagueId");

-- CreateIndex
CREATE INDEX "PowerRanking_leagueId_season_idx" ON "PowerRanking"("leagueId", "season");

-- CreateIndex
CREATE INDEX "PowerRanking_leagueId_weekNumber_idx" ON "PowerRanking"("leagueId", "weekNumber");

-- CreateIndex
CREATE INDEX "PowerRanking_status_idx" ON "PowerRanking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PowerRanking_leagueId_season_weekNumber_key" ON "PowerRanking"("leagueId", "season", "weekNumber");

-- CreateIndex
CREATE INDEX "PowerRankingEntry_powerRankingId_idx" ON "PowerRankingEntry"("powerRankingId");

-- CreateIndex
CREATE INDEX "PowerRankingEntry_teamId_idx" ON "PowerRankingEntry"("teamId");

-- CreateIndex
CREATE INDEX "PowerRankingEntry_powerRankingId_rank_idx" ON "PowerRankingEntry"("powerRankingId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "PowerRankingEntry_powerRankingId_teamId_key" ON "PowerRankingEntry"("powerRankingId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "PowerRankingEntry_powerRankingId_rank_key" ON "PowerRankingEntry"("powerRankingId", "rank");

-- CreateIndex
CREATE INDEX "Matchup_leagueId_idx" ON "Matchup"("leagueId");

-- CreateIndex
CREATE INDEX "Matchup_leagueId_season_idx" ON "Matchup"("leagueId", "season");

-- CreateIndex
CREATE INDEX "Matchup_leagueId_season_weekNumber_idx" ON "Matchup"("leagueId", "season", "weekNumber");

-- CreateIndex
CREATE INDEX "Matchup_leagueId_weekNumber_idx" ON "Matchup"("leagueId", "weekNumber");

-- CreateIndex
CREATE INDEX "Matchup_leagueId_isComplete_idx" ON "Matchup"("leagueId", "isComplete");

-- CreateIndex
CREATE INDEX "Matchup_leagueId_weekNumber_isComplete_idx" ON "Matchup"("leagueId", "weekNumber", "isComplete");

-- CreateIndex
CREATE INDEX "Matchup_externalMatchupId_idx" ON "Matchup"("externalMatchupId");

-- CreateIndex
CREATE INDEX "Matchup_homeTeamId_idx" ON "Matchup"("homeTeamId");

-- CreateIndex
CREATE INDEX "Matchup_awayTeamId_idx" ON "Matchup"("awayTeamId");

-- CreateIndex
CREATE INDEX "Matchup_matchupType_idx" ON "Matchup"("matchupType");

-- CreateIndex
CREATE UNIQUE INDEX "Matchup_leagueId_season_weekNumber_homeTeamId_awayTeamId_key" ON "Matchup"("leagueId", "season", "weekNumber", "homeTeamId", "awayTeamId");

-- CreateIndex
CREATE INDEX "MatchupPrediction_matchupId_idx" ON "MatchupPrediction"("matchupId");

-- CreateIndex
CREATE INDEX "MatchupPrediction_leagueId_idx" ON "MatchupPrediction"("leagueId");

-- CreateIndex
CREATE INDEX "MatchupPrediction_leagueId_weekNumber_idx" ON "MatchupPrediction"("leagueId", "weekNumber");

-- CreateIndex
CREATE INDEX "MatchupPrediction_leagueId_season_weekNumber_idx" ON "MatchupPrediction"("leagueId", "season", "weekNumber");

-- CreateIndex
CREATE INDEX "MatchupPrediction_leagueId_status_idx" ON "MatchupPrediction"("leagueId", "status");

-- CreateIndex
CREATE INDEX "MatchupPrediction_leagueId_weekNumber_isFeatured_idx" ON "MatchupPrediction"("leagueId", "weekNumber", "isFeatured");

-- CreateIndex
CREATE INDEX "MatchupPrediction_isFeatured_idx" ON "MatchupPrediction"("isFeatured");

-- CreateIndex
CREATE UNIQUE INDEX "MatchupPrediction_matchupId_key" ON "MatchupPrediction"("matchupId");

-- CreateIndex
CREATE INDEX "PickemEntry_userId_idx" ON "PickemEntry"("userId");

-- CreateIndex
CREATE INDEX "PickemEntry_matchupId_idx" ON "PickemEntry"("matchupId");

-- CreateIndex
CREATE INDEX "PickemEntry_leagueId_idx" ON "PickemEntry"("leagueId");

-- CreateIndex
CREATE INDEX "PickemEntry_leagueId_weekNumber_idx" ON "PickemEntry"("leagueId", "weekNumber");

-- CreateIndex
CREATE INDEX "PickemEntry_leagueId_season_weekNumber_idx" ON "PickemEntry"("leagueId", "season", "weekNumber");

-- CreateIndex
CREATE INDEX "PickemEntry_userId_leagueId_idx" ON "PickemEntry"("userId", "leagueId");

-- CreateIndex
CREATE INDEX "PickemEntry_userId_leagueId_weekNumber_idx" ON "PickemEntry"("userId", "leagueId", "weekNumber");

-- CreateIndex
CREATE INDEX "PickemEntry_userId_leagueId_season_idx" ON "PickemEntry"("userId", "leagueId", "season");

-- CreateIndex
CREATE INDEX "PickemEntry_userId_matchupId_idx" ON "PickemEntry"("userId", "matchupId");

-- CreateIndex
CREATE INDEX "PickemEntry_leagueId_weekNumber_isCorrect_idx" ON "PickemEntry"("leagueId", "weekNumber", "isCorrect");

-- CreateIndex
CREATE INDEX "PickemEntry_leagueId_season_isCorrect_idx" ON "PickemEntry"("leagueId", "season", "isCorrect");

-- CreateIndex
CREATE INDEX "PickemEntry_matchupId_isCorrect_idx" ON "PickemEntry"("matchupId", "isCorrect");

-- CreateIndex
CREATE INDEX "PickemEntry_isCorrect_idx" ON "PickemEntry"("isCorrect");

-- CreateIndex
CREATE UNIQUE INDEX "PickemEntry_userId_matchupId_key" ON "PickemEntry"("userId", "matchupId");

-- CreateIndex
CREATE INDEX "WeeklyStats_userId_idx" ON "WeeklyStats"("userId");

-- CreateIndex
CREATE INDEX "WeeklyStats_leagueId_idx" ON "WeeklyStats"("leagueId");

-- CreateIndex
CREATE INDEX "WeeklyStats_leagueId_season_weekNumber_idx" ON "WeeklyStats"("leagueId", "season", "weekNumber");

-- CreateIndex
CREATE INDEX "WeeklyStats_leagueId_weekNumber_idx" ON "WeeklyStats"("leagueId", "weekNumber");

-- CreateIndex
CREATE INDEX "WeeklyStats_userId_leagueId_idx" ON "WeeklyStats"("userId", "leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyStats_userId_leagueId_season_weekNumber_key" ON "WeeklyStats"("userId", "leagueId", "season", "weekNumber");

-- CreateIndex
CREATE INDEX "SeasonStats_userId_idx" ON "SeasonStats"("userId");

-- CreateIndex
CREATE INDEX "SeasonStats_leagueId_idx" ON "SeasonStats"("leagueId");

-- CreateIndex
CREATE INDEX "SeasonStats_leagueId_season_idx" ON "SeasonStats"("leagueId", "season");

-- CreateIndex
CREATE INDEX "SeasonStats_leagueId_season_correctPicks_idx" ON "SeasonStats"("leagueId", "season", "correctPicks");

-- CreateIndex
CREATE INDEX "SeasonStats_userId_leagueId_idx" ON "SeasonStats"("userId", "leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonStats_userId_leagueId_season_key" ON "SeasonStats"("userId", "leagueId", "season");

-- CreateIndex
CREATE INDEX "AllTimeStats_userId_idx" ON "AllTimeStats"("userId");

-- CreateIndex
CREATE INDEX "AllTimeStats_leagueId_idx" ON "AllTimeStats"("leagueId");

-- CreateIndex
CREATE INDEX "AllTimeStats_leagueId_correctPicks_idx" ON "AllTimeStats"("leagueId", "correctPicks");

-- CreateIndex
CREATE INDEX "AllTimeStats_userId_leagueId_idx" ON "AllTimeStats"("userId", "leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "AllTimeStats_userId_leagueId_key" ON "AllTimeStats"("userId", "leagueId");

-- CreateIndex
CREATE INDEX "Transaction_leagueId_idx" ON "Transaction"("leagueId");

-- CreateIndex
CREATE INDEX "Transaction_teamId_idx" ON "Transaction"("teamId");

-- CreateIndex
CREATE INDEX "Transaction_leagueId_weekNumber_idx" ON "Transaction"("leagueId", "weekNumber");

-- CreateIndex
CREATE INDEX "Transaction_leagueId_type_idx" ON "Transaction"("leagueId", "type");

-- CreateIndex
CREATE INDEX "Transaction_leagueId_timestamp_idx" ON "Transaction"("leagueId", "timestamp");

-- CreateIndex
CREATE INDEX "Transaction_timestamp_idx" ON "Transaction"("timestamp");

-- CreateIndex
CREATE INDEX "SeasonHistory_leagueId_idx" ON "SeasonHistory"("leagueId");

-- CreateIndex
CREATE INDEX "SeasonHistory_leagueId_year_idx" ON "SeasonHistory"("leagueId", "year");

-- CreateIndex
CREATE INDEX "SeasonHistory_year_idx" ON "SeasonHistory"("year");

-- CreateIndex
CREATE UNIQUE INDEX "SeasonHistory_leagueId_year_key" ON "SeasonHistory"("leagueId", "year");

-- CreateIndex
CREATE INDEX "EngagementMetrics_leagueId_idx" ON "EngagementMetrics"("leagueId");

-- CreateIndex
CREATE INDEX "EngagementMetrics_leagueId_weekNumber_idx" ON "EngagementMetrics"("leagueId", "weekNumber");

-- CreateIndex
CREATE INDEX "EngagementMetrics_weekNumber_idx" ON "EngagementMetrics"("weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "EngagementMetrics_leagueId_weekNumber_key" ON "EngagementMetrics"("leagueId", "weekNumber");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMembership" ADD CONSTRAINT "LeagueMembership_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueSettings" ADD CONSTRAINT "LeagueSettings_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Moment" ADD CONSTRAINT "Moment_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_momentId_fkey" FOREIGN KEY ("momentId") REFERENCES "Moment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_momentId_fkey" FOREIGN KEY ("momentId") REFERENCES "Moment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PowerRanking" ADD CONSTRAINT "PowerRanking_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PowerRankingEntry" ADD CONSTRAINT "PowerRankingEntry_powerRankingId_fkey" FOREIGN KEY ("powerRankingId") REFERENCES "PowerRanking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PowerRankingEntry" ADD CONSTRAINT "PowerRankingEntry_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Matchup" ADD CONSTRAINT "Matchup_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchupPrediction" ADD CONSTRAINT "MatchupPrediction_matchupId_fkey" FOREIGN KEY ("matchupId") REFERENCES "Matchup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchupPrediction" ADD CONSTRAINT "MatchupPrediction_predictedWinnerId_fkey" FOREIGN KEY ("predictedWinnerId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickemEntry" ADD CONSTRAINT "PickemEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickemEntry" ADD CONSTRAINT "PickemEntry_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickemEntry" ADD CONSTRAINT "PickemEntry_matchupId_fkey" FOREIGN KEY ("matchupId") REFERENCES "Matchup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PickemEntry" ADD CONSTRAINT "PickemEntry_predictedWinnerId_fkey" FOREIGN KEY ("predictedWinnerId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyStats" ADD CONSTRAINT "WeeklyStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyStats" ADD CONSTRAINT "WeeklyStats_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonStats" ADD CONSTRAINT "SeasonStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonStats" ADD CONSTRAINT "SeasonStats_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllTimeStats" ADD CONSTRAINT "AllTimeStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllTimeStats" ADD CONSTRAINT "AllTimeStats_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeasonHistory" ADD CONSTRAINT "SeasonHistory_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EngagementMetrics" ADD CONSTRAINT "EngagementMetrics_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

