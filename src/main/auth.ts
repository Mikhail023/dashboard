import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
export function hashPassword(
  password: string,
  salt = randomBytes(32).toString("hex"),
) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}
export function verifyPassword(password: string, salt: string, hash: string) {
  const candidate = Buffer.from(hashPassword(password, salt).hash, "hex");
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length && timingSafeEqual(candidate, expected)
  );
}
export class LoginLimiter {
  attempts = 0;
  until = 0;
  check() {
    if (Date.now() < this.until)
      throw new Error(
        `Повторите через ${Math.ceil((this.until - Date.now()) / 1000)} сек.`,
      );
  }
  fail() {
    this.attempts++;
    if (this.attempts >= 5)
      this.until =
        Date.now() +
        Math.min(30 * 2 ** Math.floor((this.attempts - 5) / 5), 1800) * 1000;
  }
  reset() {
    this.attempts = 0;
    this.until = 0;
  }
}
