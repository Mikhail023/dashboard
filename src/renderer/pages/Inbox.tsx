import { useEffect, useState } from "react";
import { useData, useApp, active } from "../store";
import { Button, Card, Empty, Heading, Tabs } from "../components/UI";
import type { Row } from "../../shared/model";
export default function Inbox() {
  const data = useData(),
    edit = useApp((s) => s.edit);
  const selected = useApp((s) => s.selected);
  useEffect(() => {
    const item = useApp
      .getState()
      .state?.data.inbox.find((i) => i.id === selected && !i.deleted_at);
    if (item) edit("inbox", item);
  }, [selected, edit]);
  const [tab, setTab] = useState<string>(
      data.inbox.find((i) => i.id === selected)?.status ?? "pending",
    ),
    [busy, setBusy] = useState("");
  const items = active(data.inbox).filter((i) => i.status === tab);
  const convert = async (id: string, table: "notes" | "tasks" | "projects") => {
    setBusy(id);
    try {
      const row = await useApp
        .getState()
        .run<Row>({ action: "convertInbox", id, table });
      useApp.getState().navigate(table, row.id);
    } catch {
      /* toast supplied by store */
    } finally {
      setBusy("");
    }
  };
  return (
    <>
      <Heading
        title="Входящие"
        subtitle={`${active(data.inbox).filter((i) => i.status === "pending").length} необработанных записей`}
      >
        <Button onClick={() => edit("inbox")}>Добавить</Button>
      </Heading>
      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          ["pending", "Необработанные"],
          ["processed", "Обработанные"],
        ]}
      />
      <Card>
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="simple-row">
              <button onClick={() => edit("inbox", item)}>
                <strong>{item.title}</strong>
                <small className="block muted">{item.content}</small>
              </button>
              <div className="row">
                {item.status === "pending" ? (
                  (
                    [
                      ["notes", "В заметку"],
                      ["tasks", "В задачу"],
                      ["projects", "В проект"],
                    ] as const
                  ).map(([table, label]) => (
                    <Button
                      secondary
                      key={table}
                      disabled={!!busy}
                      onClick={() => void convert(item.id, table)}
                    >
                      {label}
                    </Button>
                  ))
                ) : (
                  <Button
                    secondary
                    onClick={() => {
                      if (item.converted_table)
                        useApp
                          .getState()
                          .navigate(item.converted_table, item.converted_id);
                    }}
                  >
                    Открыть результат
                  </Button>
                )}
              </div>
            </div>
          ))
        ) : (
          <Empty text="Всё разобрано" onCreate={() => edit("inbox")} />
        )}
      </Card>
    </>
  );
}
