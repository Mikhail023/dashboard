import { describe, expect, it } from "vitest";
import { emptyData } from "../src/shared/model";
import { parseDate, parseSmartInput } from "../src/shared/smart-input";
const now = new Date(2026, 9, 6, 10);
describe("Local Smart Input", () => {
  it("recognizes the requested Russian examples", () => {
    const parse = (s: string) => parseSmartInput(s, emptyData(), now);
    expect(parse("Купить корм коту завтра вечером").fields.due_date).toBe(
      "2026-10-07T18:00",
    );
    expect(parse("Потратил 890 рублей на такси")).toMatchObject({
      kind: "expense",
      amount: 890,
      currency: "RUB",
      categoryName: "Транспорт",
    });
    expect(parse("Получил 50000 зарплата")).toMatchObject({
      kind: "income",
      amount: 50000,
      categoryName: "Зарплата",
    });
    expect(parse("Идея для приложения: добавить виджет курса валют").kind).toBe(
      "note",
    );
    expect(parse("Встреча с Иваном завтра в 14:30").fields.start_at).toBe(
      "2026-10-07T14:30",
    );
    expect(parse("посмотреть приложение X").kind).toBe("inbox");
  });
  it("handles grouped decimals and calendar boundaries", () => {
    expect(
      parseSmartInput("Потратил 1 234,50 евро", emptyData(), now).amount,
    ).toBe(1234.5);
    expect(parseDate("завтра", new Date(2026, 11, 31)).day).toBe("2027-01-01");
    expect(parseDate("31.02.2026", now).warning).not.toBe("");
  });
});

it("handles an unrepresentable relative date without crashing the preview", () => {
  expect(parseDate("через 999999999999999999999 дней", now).warning).not.toBe(
    "",
  );
});
