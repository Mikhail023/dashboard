import Database from "better-sqlite3";
/** Storage boundary for a future SQLCipher-compatible adapter. No encryption is claimed by this adapter. */
export interface DatabaseFactory {
  open(path: string): Database.Database;
}
export const plainSQLite: DatabaseFactory = {
  open: (path) => new Database(path),
};
