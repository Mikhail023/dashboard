-- Additive only: a goal and one active value per local calendar day.
CREATE TABLE daily_goals (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'boolean' CHECK(kind IN ('boolean','quantitative')),
 target_value REAL NOT NULL DEFAULT 1 CHECK(target_value > 0), unit TEXT NOT NULL DEFAULT 'раз',
 icon TEXT NOT NULL DEFAULT 'target', color TEXT NOT NULL DEFAULT '', project_id TEXT NOT NULL DEFAULT '',
 start_date TEXT NOT NULL, aliases TEXT NOT NULL DEFAULT '', archived INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NOT NULL DEFAULT '', demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX daily_goals_project ON daily_goals(project_id);
CREATE TABLE daily_goal_entries (
 id TEXT PRIMARY KEY, goal_id TEXT NOT NULL REFERENCES daily_goals(id), day TEXT NOT NULL,
 value REAL NOT NULL DEFAULT 0 CHECK(value >= 0),
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT NOT NULL DEFAULT '', demo INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX daily_goal_day ON daily_goal_entries(goal_id,day) WHERE deleted_at='';
CREATE INDEX daily_goal_entries_day ON daily_goal_entries(day);
