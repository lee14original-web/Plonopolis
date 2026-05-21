-- Migration: add hive_data column to profiles
-- Run once in Supabase SQL editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS hive_data JSONB DEFAULT NULL;

-- Seed existing rows with default hive state (level 1, nothing collected)
UPDATE profiles
SET hive_data = '{"level":1,"bees_progress":0,"honey_start":null,"suit_durability":0,"empty_jars":0,"honey_jars":0}'::jsonb
WHERE hive_data IS NULL;
