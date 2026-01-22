-- Migration: Create Database Triggers for Stats Updates (task-16)
-- This migration implements PostgreSQL triggers to automatically update
-- leaderboard stats (WeeklyStats, SeasonStats, AllTimeStats) when pick'em
-- entries are graded.

-- ============================================================================
-- HELPER FUNCTION: Calculate accuracy percentage
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_accuracy(correct_picks INTEGER, total_picks INTEGER)
RETURNS FLOAT AS $$
BEGIN
  IF total_picks = 0 THEN
    RETURN 0;
  END IF;
  RETURN ROUND((correct_picks::FLOAT / total_picks::FLOAT) * 100, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- TRIGGER FUNCTION: Update WeeklyStats on pick entry grading
-- Called when a PickemEntry is INSERT/UPDATE with isCorrect set
-- ============================================================================
CREATE OR REPLACE FUNCTION update_weekly_stats_on_pick_grading()
RETURNS TRIGGER AS $$
DECLARE
  v_weekly_stats_id TEXT;
  v_total_picks INTEGER;
  v_correct_picks INTEGER;
  v_accuracy FLOAT;
  v_season INTEGER;
BEGIN
  -- Only process if isCorrect is being set (grading happening)
  IF NEW."isCorrect" IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get season from the pick (default to current year if not set)
  v_season := COALESCE(NEW.season, EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER);

  -- Calculate aggregated stats for this user/league/week
  SELECT
    COUNT(*)::INTEGER,
    COUNT(*) FILTER (WHERE "isCorrect" = true)::INTEGER
  INTO v_total_picks, v_correct_picks
  FROM "PickemEntry"
  WHERE "userId" = NEW."userId"
    AND "leagueId" = NEW."leagueId"
    AND "weekNumber" = NEW."weekNumber"
    AND "isCorrect" IS NOT NULL;

  -- Calculate accuracy
  v_accuracy := calculate_accuracy(v_correct_picks, v_total_picks);

  -- Upsert WeeklyStats record
  INSERT INTO "WeeklyStats" (
    id,
    "userId",
    "leagueId",
    season,
    "weekNumber",
    "totalPicks",
    "correctPicks",
    accuracy,
    "createdAt",
    "updatedAt"
  ) VALUES (
    gen_random_uuid()::TEXT,
    NEW."userId",
    NEW."leagueId",
    v_season,
    NEW."weekNumber",
    v_total_picks,
    v_correct_picks,
    v_accuracy,
    NOW(),
    NOW()
  )
  ON CONFLICT ("userId", "leagueId", season, "weekNumber")
  DO UPDATE SET
    "totalPicks" = v_total_picks,
    "correctPicks" = v_correct_picks,
    accuracy = v_accuracy,
    "updatedAt" = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER FUNCTION: Update SeasonStats when WeeklyStats changes
-- Recalculates season totals and streak data
-- ============================================================================
CREATE OR REPLACE FUNCTION update_season_stats_on_weekly_change()
RETURNS TRIGGER AS $$
DECLARE
  v_total_picks INTEGER;
  v_correct_picks INTEGER;
  v_accuracy FLOAT;
  v_perfect_weeks INTEGER;
  v_best_week_accuracy FLOAT;
  v_current_streak INTEGER := 0;
  v_longest_streak INTEGER := 0;
  v_temp_streak INTEGER := 0;
  r_pick RECORD;
BEGIN
  -- Calculate aggregated stats from all weekly stats for this user/league/season
  SELECT
    COALESCE(SUM("totalPicks"), 0)::INTEGER,
    COALESCE(SUM("correctPicks"), 0)::INTEGER,
    COUNT(*) FILTER (WHERE accuracy = 100)::INTEGER,
    MAX(accuracy)
  INTO v_total_picks, v_correct_picks, v_perfect_weeks, v_best_week_accuracy
  FROM "WeeklyStats"
  WHERE "userId" = NEW."userId"
    AND "leagueId" = NEW."leagueId"
    AND season = NEW.season;

  -- Calculate accuracy
  v_accuracy := calculate_accuracy(v_correct_picks, v_total_picks);

  -- Calculate streak from individual picks (ordered by submission time)
  -- Current streak = consecutive correct picks from most recent
  -- Longest streak = longest consecutive correct picks ever in the season
  FOR r_pick IN
    SELECT "isCorrect"
    FROM "PickemEntry"
    WHERE "userId" = NEW."userId"
      AND "leagueId" = NEW."leagueId"
      AND season = NEW.season
      AND "isCorrect" IS NOT NULL
    ORDER BY "weekNumber" ASC, "submittedAt" ASC
  LOOP
    IF r_pick."isCorrect" = true THEN
      v_temp_streak := v_temp_streak + 1;
      IF v_temp_streak > v_longest_streak THEN
        v_longest_streak := v_temp_streak;
      END IF;
    ELSE
      v_temp_streak := 0;
    END IF;
  END LOOP;

  -- Current streak is from the most recent picks going backwards
  v_current_streak := 0;
  FOR r_pick IN
    SELECT "isCorrect"
    FROM "PickemEntry"
    WHERE "userId" = NEW."userId"
      AND "leagueId" = NEW."leagueId"
      AND season = NEW.season
      AND "isCorrect" IS NOT NULL
    ORDER BY "weekNumber" DESC, "submittedAt" DESC
  LOOP
    IF r_pick."isCorrect" = true THEN
      v_current_streak := v_current_streak + 1;
    ELSE
      EXIT; -- Break on first wrong pick
    END IF;
  END LOOP;

  -- Upsert SeasonStats record
  INSERT INTO "SeasonStats" (
    id,
    "userId",
    "leagueId",
    season,
    "totalPicks",
    "correctPicks",
    accuracy,
    "currentStreak",
    "longestStreak",
    "perfectWeeks",
    "bestWeekAccuracy",
    "createdAt",
    "updatedAt"
  ) VALUES (
    gen_random_uuid()::TEXT,
    NEW."userId",
    NEW."leagueId",
    NEW.season,
    v_total_picks,
    v_correct_picks,
    v_accuracy,
    v_current_streak,
    v_longest_streak,
    v_perfect_weeks,
    v_best_week_accuracy,
    NOW(),
    NOW()
  )
  ON CONFLICT ("userId", "leagueId", season)
  DO UPDATE SET
    "totalPicks" = v_total_picks,
    "correctPicks" = v_correct_picks,
    accuracy = v_accuracy,
    "currentStreak" = v_current_streak,
    "longestStreak" = GREATEST("SeasonStats"."longestStreak", v_longest_streak),
    "perfectWeeks" = v_perfect_weeks,
    "bestWeekAccuracy" = GREATEST("SeasonStats"."bestWeekAccuracy", v_best_week_accuracy),
    "updatedAt" = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER FUNCTION: Update AllTimeStats when SeasonStats changes
-- Recalculates all-time totals and records
-- ============================================================================
CREATE OR REPLACE FUNCTION update_alltime_stats_on_season_change()
RETURNS TRIGGER AS $$
DECLARE
  v_total_picks INTEGER;
  v_correct_picks INTEGER;
  v_accuracy FLOAT;
  v_longest_streak INTEGER;
  v_seasons_played INTEGER;
  v_best_season_accuracy FLOAT;
  v_perfect_weeks_total INTEGER;
BEGIN
  -- Calculate aggregated stats from all season stats for this user/league
  SELECT
    COALESCE(SUM("totalPicks"), 0)::INTEGER,
    COALESCE(SUM("correctPicks"), 0)::INTEGER,
    COALESCE(MAX("longestStreak"), 0)::INTEGER,
    COUNT(DISTINCT season)::INTEGER,
    MAX(accuracy),
    COALESCE(SUM("perfectWeeks"), 0)::INTEGER
  INTO
    v_total_picks,
    v_correct_picks,
    v_longest_streak,
    v_seasons_played,
    v_best_season_accuracy,
    v_perfect_weeks_total
  FROM "SeasonStats"
  WHERE "userId" = NEW."userId"
    AND "leagueId" = NEW."leagueId";

  -- Calculate accuracy
  v_accuracy := calculate_accuracy(v_correct_picks, v_total_picks);

  -- Upsert AllTimeStats record
  INSERT INTO "AllTimeStats" (
    id,
    "userId",
    "leagueId",
    "totalPicks",
    "correctPicks",
    accuracy,
    "longestStreak",
    "seasonsPlayed",
    "bestSeasonAccuracy",
    "perfectWeeksTotal",
    "createdAt",
    "updatedAt"
  ) VALUES (
    gen_random_uuid()::TEXT,
    NEW."userId",
    NEW."leagueId",
    v_total_picks,
    v_correct_picks,
    v_accuracy,
    v_longest_streak,
    v_seasons_played,
    v_best_season_accuracy,
    v_perfect_weeks_total,
    NOW(),
    NOW()
  )
  ON CONFLICT ("userId", "leagueId")
  DO UPDATE SET
    "totalPicks" = v_total_picks,
    "correctPicks" = v_correct_picks,
    accuracy = v_accuracy,
    "longestStreak" = GREATEST("AllTimeStats"."longestStreak", v_longest_streak),
    "seasonsPlayed" = v_seasons_played,
    "bestSeasonAccuracy" = GREATEST("AllTimeStats"."bestSeasonAccuracy", v_best_season_accuracy),
    "perfectWeeksTotal" = v_perfect_weeks_total,
    "updatedAt" = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

-- Trigger: Update WeeklyStats when PickemEntry is graded (INSERT or UPDATE)
DROP TRIGGER IF EXISTS trg_update_weekly_stats_on_pick_grading ON "PickemEntry";
CREATE TRIGGER trg_update_weekly_stats_on_pick_grading
  AFTER INSERT OR UPDATE OF "isCorrect", "pointsEarned"
  ON "PickemEntry"
  FOR EACH ROW
  WHEN (NEW."isCorrect" IS NOT NULL)
  EXECUTE FUNCTION update_weekly_stats_on_pick_grading();

-- Trigger: Update SeasonStats when WeeklyStats changes
DROP TRIGGER IF EXISTS trg_update_season_stats_on_weekly_change ON "WeeklyStats";
CREATE TRIGGER trg_update_season_stats_on_weekly_change
  AFTER INSERT OR UPDATE
  ON "WeeklyStats"
  FOR EACH ROW
  EXECUTE FUNCTION update_season_stats_on_weekly_change();

-- Trigger: Update AllTimeStats when SeasonStats changes
DROP TRIGGER IF EXISTS trg_update_alltime_stats_on_season_change ON "SeasonStats";
CREATE TRIGGER trg_update_alltime_stats_on_season_change
  AFTER INSERT OR UPDATE
  ON "SeasonStats"
  FOR EACH ROW
  EXECUTE FUNCTION update_alltime_stats_on_season_change();

-- ============================================================================
-- COMMENTS for documentation
-- ============================================================================
COMMENT ON FUNCTION update_weekly_stats_on_pick_grading() IS
  'Trigger function that updates WeeklyStats when a PickemEntry is graded (task-16)';

COMMENT ON FUNCTION update_season_stats_on_weekly_change() IS
  'Trigger function that recalculates SeasonStats when WeeklyStats changes, including streak tracking (task-16)';

COMMENT ON FUNCTION update_alltime_stats_on_season_change() IS
  'Trigger function that recalculates AllTimeStats when SeasonStats changes (task-16)';

COMMENT ON TRIGGER trg_update_weekly_stats_on_pick_grading ON "PickemEntry" IS
  'Updates WeeklyStats automatically when pick entries are graded';

COMMENT ON TRIGGER trg_update_season_stats_on_weekly_change ON "WeeklyStats" IS
  'Updates SeasonStats automatically when weekly stats change';

COMMENT ON TRIGGER trg_update_alltime_stats_on_season_change ON "SeasonStats" IS
  'Updates AllTimeStats automatically when season stats change';
