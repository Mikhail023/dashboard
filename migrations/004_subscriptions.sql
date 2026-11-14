-- Subscription records are independent from one-off transactions.
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount REAL NOT NULL CHECK(amount > 0),
  currency TEXT NOT NULL DEFAULT 'RUB',
  interval TEXT NOT NULL CHECK(interval IN ('daily','weekly','monthly','yearly')),
  next_payment_at TEXT NOT NULL,
  reminder_days INTEGER NOT NULL DEFAULT 1 CHECK(reminder_days BETWEEN 0 AND 30),
  reminder_sent_for TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT NOT NULL DEFAULT '',
  demo INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX subscriptions_due ON subscriptions(active,next_payment_at,deleted_at);
