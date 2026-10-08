-- Additive migration: existing records and identifiers remain intact.
ALTER TABLE tasks ADD COLUMN note_id TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN recurrence_rule TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN recurrence_interval INTEGER NOT NULL DEFAULT 1;
ALTER TABLE tasks ADD COLUMN recurrence_days TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN recurrence_until TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN recurrence_interval INTEGER NOT NULL DEFAULT 1;
ALTER TABLE events ADD COLUMN recurrence_days TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN recurrence_until TEXT NOT NULL DEFAULT '';
CREATE INDEX tasks_note ON tasks(note_id);
CREATE INDEX notes_project ON notes(project_id);
CREATE INDEX events_project ON events(project_id);
CREATE INDEX transactions_project ON transactions(project_id);
CREATE TABLE inbox(id TEXT PRIMARY KEY,title TEXT NOT NULL,content TEXT NOT NULL DEFAULT '',project_id TEXT NOT NULL DEFAULT '',tags TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'pending',converted_table TEXT NOT NULL DEFAULT '',converted_id TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,deleted_at TEXT NOT NULL DEFAULT '',demo INTEGER NOT NULL DEFAULT 0);
CREATE TABLE budgets(id TEXT PRIMARY KEY,name TEXT NOT NULL,category_id TEXT NOT NULL DEFAULT '',amount REAL NOT NULL CHECK(amount > 0),currency TEXT NOT NULL DEFAULT 'RUB',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,deleted_at TEXT NOT NULL DEFAULT '',demo INTEGER NOT NULL DEFAULT 0);
CREATE TABLE financial_goals(id TEXT PRIMARY KEY,name TEXT NOT NULL,target_amount REAL NOT NULL CHECK(target_amount > 0),current_amount REAL NOT NULL DEFAULT 0 CHECK(current_amount >= 0),currency TEXT NOT NULL DEFAULT 'RUB',status TEXT NOT NULL DEFAULT 'active',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,deleted_at TEXT NOT NULL DEFAULT '',demo INTEGER NOT NULL DEFAULT 0);
-- Completion facts are real timestamps, not copies of recurring tasks.
CREATE TABLE task_completions(id TEXT PRIMARY KEY,task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,occurrence_date TEXT NOT NULL,completed_at TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,deleted_at TEXT NOT NULL DEFAULT '',demo INTEGER NOT NULL DEFAULT 0);
CREATE UNIQUE INDEX task_occurrence_completion ON task_completions(task_id,occurrence_date) WHERE deleted_at='';
