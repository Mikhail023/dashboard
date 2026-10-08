import { useState } from "react";
import FinancePlanning from "../components/FinancePlanning";
import {
  Plus,
  ArrowUpRight,
  CreditCard,
  Wallet,
  Building2,
  Download,
  Search,
  Check,
  FileText,
} from "lucide-react";
import { useApp, useData, active, action } from "../store";
import {
  balance,
  summary,
  invoiceTotal,
  formatMoney,
} from "../../shared/calculations";
import { labels } from "../../shared/model";
import {
  Badge,
  Button,
  Card,
  Empty,
  Heading,
  IconButton,
  Stat,
  Tabs,
} from "../components/UI";
export default function Finance() {
  const data = useData(),
    edit = useApp((s) => s.edit),
    selected = useApp((s) => s.selected),
    currency = useApp((s) => s.state?.settings.currency) ?? "RUB";
  const [tab, setTab] = useState(selected ? "invoices" : "overview"),
    [account, setAccount] = useState(""),
    [type, setType] = useState(""),
    [category, setCategory] = useState(""),
    [period, setPeriod] = useState(""),
    [query, setQuery] = useState(""),
    [invoiceTab, setInvoiceTab] = useState("all"),
    [invoiceId, setInvoiceId] = useState(selected),
    [payAccount, setPayAccount] = useState("");
  const s = summary(data, currency),
    accounts = active(data.accounts);
  const today = new Date().toISOString().slice(0, 10);
  const invoices = active(data.invoices)
    .map((i) => ({
      ...i,
      status:
        i.status !== "paid" &&
        i.status !== "draft" &&
        i.due_date &&
        i.due_date < today
          ? "overdue"
          : i.status,
    }))
    .filter(
      (i) =>
        invoiceTab === "all" ||
        (invoiceTab === "unpaid"
          ? i.status !== "paid" && i.status !== "draft"
          : i.status === invoiceTab),
    );
  const inv = invoices.find((i) => i.id === invoiceId) ?? invoices[0];
  const tx = active(data.transactions)
    .filter(
      (t) =>
        (!account || t.account_id === account || t.to_account_id === account) &&
        (!type || t.type === type) &&
        (!category || t.category_id === category) &&
        (!period || t.date.startsWith(period)) &&
        t.note.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const fmt = (n: number, c = currency) => formatMoney(n, c);
  const overdue = active(data.invoices)
    .filter(
      (i) =>
        i.due_date &&
        i.due_date < today &&
        i.status !== "paid" &&
        i.status !== "draft" &&
        i.currency === currency,
    )
    .reduce((sum, i) => sum + invoiceTotal(data, i.id), 0);
  const nextMonth = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const upcoming = active(data.invoices)
    .filter(
      (i) =>
        i.due_date >= today &&
        i.due_date <= nextMonth &&
        i.status !== "paid" &&
        i.status !== "draft" &&
        i.currency === currency,
    )
    .reduce((sum, i) => sum + invoiceTotal(data, i.id), 0);
  const paid = active(data.invoices).filter((i) => i.paid_at && i.issue_date);
  const average = paid.length
    ? Math.round(
        paid.reduce(
          (sum, i) =>
            sum + (+new Date(i.paid_at) - +new Date(i.issue_date)) / 86400000,
          0,
        ) / paid.length,
      )
    : 0;
  return (
    <>
      <Heading
        title="Финансы"
        subtitle="Ясная картина ваших доходов и расходов"
      >
        <Button secondary onClick={() => edit("invoices")}>
          <FileText size={16} />
          Выставить счёт
        </Button>
        <Button onClick={() => edit("transactions")}>
          <Plus size={17} />
          Операция
        </Button>
      </Heading>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          ["overview", "Обзор"],
          ["transactions", "Транзакции"],
          ["invoices", "Счета-фактуры"],
          ["categories", "Категории"],
          ["budgets", "Бюджеты"],
          ["goals", "Цели"],
        ]}
      />
      {(tab === "budgets" || tab === "goals") && (
        <Card>
          <FinancePlanning
            kind={tab === "budgets" ? "budgets" : "financial_goals"}
          />
        </Card>
      )}
      {tab === "overview" && (
        <div className="stats-grid">
          <Stat
            label="Просрочено"
            value={fmt(overdue)}
            caption="Неоплаченные счета"
          />
          <Stat
            label="В ближайший месяц"
            value={fmt(upcoming)}
            caption="Ожидаемые поступления"
          />
          <Stat
            label="Средний срок оплаты"
            value={`${average} дн.`}
            caption={
              paid.length
                ? "По оплаченным счетам"
                : "Пока нет оплаченных счетов"
            }
          />
          <Stat
            label="Доступно"
            value={fmt(s.balance)}
            caption={`По всем счетам в ${currency}`}
            accent
          />
        </div>
      )}
      <div className="account-row">
        {accounts.map((a) => (
          <button
            key={a.id}
            className={`account-card ${account === a.id ? "selected" : ""}`}
            onClick={() => setAccount(account === a.id ? "" : a.id)}
            onDoubleClick={() => edit("accounts", a)}
          >
            <span className="row">
              {a.type === "cash" ? (
                <Wallet size={20} />
              ) : a.type === "bank" ? (
                <Building2 size={20} />
              ) : (
                <CreditCard size={20} />
              )}{" "}
              {a.name}
            </span>
            <strong>{fmt(balance(data, a), a.currency)}</strong>
            <span className="row">
              <small>
                {labels[a.type]} · {a.currency}
              </small>
              <span
                role="button"
                tabIndex={0}
                aria-label={`Изменить ${a.name}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.stopPropagation();
                    edit("accounts", a);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  edit("accounts", a);
                }}
              >
                <ArrowUpRight size={17} />
              </span>
            </span>
          </button>
        ))}
        <button className="account-add" onClick={() => edit("accounts")}>
          <Plus size={23} />
          <span>Добавить счёт</span>
        </button>
      </div>
      {tab === "overview" && (
        <div className="finance-charts">
          <Card title="Доходы и расходы">
            <div className="month-chart">
              {Array.from({ length: 6 }, (_, i) => {
                const d = new Date();
                d.setMonth(d.getMonth() - 5 + i);
                const month = d.toISOString().slice(0, 7);
                const m = summary(data, currency, month);
                const max = Math.max(
                  1,
                  ...Array.from({ length: 6 }, (_, j) => {
                    const d2 = new Date();
                    d2.setMonth(d2.getMonth() - 5 + j);
                    const x = summary(
                      data,
                      currency,
                      d2.toISOString().slice(0, 7),
                    );
                    return Math.max(x.income, x.expense);
                  }),
                );
                return (
                  <div key={month}>
                    <div className="month-columns">
                      <i
                        title={`Доход ${fmt(m.income)}`}
                        style={{
                          height: `${Math.max(2, (m.income / max) * 130)}px`,
                        }}
                      />
                      <i
                        className="hatched"
                        title={`Расход ${fmt(m.expense)}`}
                        style={{
                          height: `${Math.max(2, (m.expense / max) * 130)}px`,
                        }}
                      />
                    </div>
                    <small>
                      {d.toLocaleDateString("ru-RU", { month: "short" })}
                    </small>
                  </div>
                );
              })}
            </div>
            <div className="legend">
              <span>
                <i />
                Доход
              </span>
              <span>
                <i className="hatched" />
                Расход
              </span>
            </div>
          </Card>
          <Card title="Структура расходов">
            <small>Текущий месяц · {currency}</small>
            {active(data.categories)
              .filter((c) => c.type === "expense")
              .map((c) => {
                const amount = active(data.transactions)
                  .filter(
                    (t) =>
                      t.type === "expense" &&
                      t.category_id === c.id &&
                      t.date.startsWith(today.slice(0, 7)) &&
                      accounts.find((a) => a.id === t.account_id)?.currency ===
                        currency,
                  )
                  .reduce((sum, t) => sum + t.amount, 0);
                return (
                  <div className="category-bar" key={c.id}>
                    <div className="progress-label">
                      <span>{c.name}</span>
                      <strong>{fmt(amount)}</strong>
                    </div>
                    <div className="progress">
                      <i
                        style={{
                          background: c.color,
                          width: `${s.expense ? (amount / s.expense) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            {!data.categories.length && (
              <Empty onCreate={() => edit("categories")} />
            )}
          </Card>
        </div>
      )}
      {(tab === "transactions" || tab === "overview") && (
        <Card
          title={tab === "overview" ? "Последние операции" : "Транзакции"}
          action={
            <IconButton
              label="Экспорт CSV"
              onClick={() =>
                void action(
                  { action: "export", table: "transactions", format: "csv" },
                  "CSV сохранён",
                )
              }
            >
              <Download size={17} />
            </IconButton>
          }
        >
          <div className="filters">
            <div className="search-field">
              <Search size={15} />
              <input
                placeholder="Найти операцию…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              aria-label="Тип операции"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">Все типы</option>
              {["income", "expense", "transfer"].map((t) => (
                <option value={t} key={t}>
                  {labels[t]}
                </option>
              ))}
            </select>
            <select
              aria-label="Категория"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Все категории</option>
              {active(data.categories).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Месяц"
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>
          {tx.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Операция</th>
                    <th>Счёт</th>
                    <th>Категория</th>
                    <th>Дата</th>
                    <th>Сумма</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tx.slice(0, tab === "overview" ? 6 : undefined).map((t) => (
                    <tr key={t.id}>
                      <td>
                        <span className={`transaction-icon ${t.type}`}>
                          <ArrowUpRight size={15} />
                        </span>
                        {t.note || labels[t.type]}
                      </td>
                      <td>
                        {accounts.find((a) => a.id === t.account_id)?.name}
                      </td>
                      <td>
                        {data.categories.find((c) => c.id === t.category_id)
                          ?.name ?? "—"}
                      </td>
                      <td>{t.date}</td>
                      <td className={t.type === "income" ? "positive" : ""}>
                        {t.type === "income"
                          ? "+"
                          : t.type === "expense"
                            ? "−"
                            : ""}
                        {fmt(
                          t.amount,
                          accounts.find((a) => a.id === t.account_id)?.currency,
                        )}
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => edit("transactions", t)}
                        >
                          Изменить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty onCreate={() => edit("transactions")} />
          )}
        </Card>
      )}
      {tab === "invoices" && (
        <>
          <div className="filters">
            <Tabs
              value={invoiceTab}
              onChange={setInvoiceTab}
              options={[
                ["all", "Все"],
                ["draft", "Черновики"],
                ["unpaid", "Неоплаченные"],
                ["paid", "Оплаченные"],
              ]}
            />
            <Button
              secondary
              onClick={() =>
                void action(
                  { action: "export", table: "invoices", format: "csv" },
                  "CSV сохранён",
                )
              }
            >
              <Download size={16} />
              CSV
            </Button>
          </div>
          <div className="invoice-layout">
            <div className="invoice-list">
              {invoices.length ? (
                invoices.map((i) => (
                  <button
                    className={`invoice-row ${i.id === inv?.id ? "selected" : ""}`}
                    key={i.id}
                    onClick={() => setInvoiceId(i.id)}
                  >
                    <span className="client-avatar">
                      {i.client_name.slice(0, 2)}
                    </span>
                    <span>
                      <strong>{i.number}</strong>
                      <small>{i.client_name}</small>
                      <Badge status={i.status} />
                    </span>
                    <span>
                      <strong>
                        {fmt(invoiceTotal(data, i.id), i.currency)}
                      </strong>
                      <small>
                        {i.due_date
                          ? `До ${new Date(i.due_date).toLocaleDateString("ru-RU")}`
                          : "Без срока"}
                      </small>
                    </span>
                  </button>
                ))
              ) : (
                <Empty onCreate={() => edit("invoices")} />
              )}
            </div>
            {inv ? (
              <div className="invoice-details">
                <div className="card-heading">
                  <span className="invoice-symbol">
                    <FileText size={25} />
                  </span>
                  <Badge status={inv.status} />
                </div>
                <h2>{inv.number}</h2>
                <div className="invoice-meta">
                  <div>
                    <small>КОМПАНИЯ</small>
                    <strong>{inv.company || "—"}</strong>
                  </div>
                  <div>
                    <small>КЛИЕНТ</small>
                    <strong>{inv.client_name}</strong>
                  </div>
                </div>
                <h3>Позиции счёта</h3>
                <div className="invoice-items">
                  {active(data.invoice_items)
                    .filter((i) => i.invoice_id === inv.id)
                    .map((i) => (
                      <button
                        key={i.id}
                        disabled={inv.status === "paid"}
                        onClick={() => edit("invoice_items", i)}
                      >
                        <span>{i.title}</span>
                        <strong>{fmt(i.amount, inv.currency)}</strong>
                      </button>
                    ))}
                </div>
                {inv.status !== "paid" && (
                  <button
                    className="text-button"
                    onClick={() =>
                      edit("invoice_items", undefined, { invoice_id: inv.id })
                    }
                  >
                    + Добавить позицию
                  </button>
                )}
                <div className="invoice-total">
                  <span>Итого</span>
                  <strong>
                    {fmt(invoiceTotal(data, inv.id), inv.currency)}
                  </strong>
                </div>
                {inv.status !== "paid" ? (
                  <>
                    <label>
                      Зачислить на счёт
                      <select
                        value={payAccount}
                        onChange={(e) => setPayAccount(e.target.value)}
                      >
                        <option value="">Выберите счёт</option>
                        {accounts
                          .filter((a) => a.currency === inv.currency)
                          .map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Button
                      className="full-width"
                      disabled={!payAccount}
                      onClick={() =>
                        void action(
                          {
                            action: "payInvoice",
                            id: inv.id,
                            account_id: payAccount,
                          },
                          "Оплата учтена. Доход добавлен.",
                        )
                      }
                    >
                      <Check size={17} />
                      Отметить оплаченным
                    </Button>
                  </>
                ) : (
                  <p className="positive">Оплата учтена в транзакциях</p>
                )}
                <div className="row">
                  <Button
                    secondary
                    onClick={() =>
                      void action(
                        {
                          action: "export",
                          table: "invoices",
                          id: inv.id,
                          format: "pdf",
                        },
                        "PDF сохранён",
                      )
                    }
                  >
                    Экспорт PDF
                  </Button>
                  {inv.status !== "paid" && (
                    <Button
                      secondary
                      onClick={() =>
                        edit(
                          "invoices",
                          data.invoices.find((i) => i.id === inv.id),
                        )
                      }
                    >
                      Изменить
                    </Button>
                  )}
                </div>
                <p>{inv.notes}</p>
              </div>
            ) : null}
          </div>
        </>
      )}
      {tab === "categories" && (
        <Card
          title="Категории"
          action={
            <Button onClick={() => edit("categories")}>
              <Plus size={16} />
              Добавить
            </Button>
          }
        >
          {active(data.categories).map((c) => (
            <button
              className="simple-row"
              key={c.id}
              onClick={() => edit("categories", c)}
            >
              <i className="dot" style={{ background: c.color }} />
              {c.name}
              <Badge status={c.type} />
              <ArrowUpRight size={16} />
            </button>
          ))}
        </Card>
      )}
    </>
  );
}
