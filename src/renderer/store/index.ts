import { create } from "zustand";
import {
  emptyData,
  type State,
  type AuthState,
  type Request,
  type Table,
  type Row,
} from "../../shared/model";
export type Page =
  | "habits"
  | "inbox"
  | "timeline"
  | "focus"
  | "dashboard"
  | "notes"
  | "tasks"
  | "calendar"
  | "finance"
  | "projects"
  | "settings"
  | "help";
interface Store {
  state: State | null;
  auth: AuthState | null;
  page: Page;
  selected: string;
  toast: string;
  searchOpen: boolean;
  smartOpen: boolean;
  editor: {
    table: Table;
    row?: Row;
    defaults?: Record<string, unknown>;
  } | null;
  refresh: () => Promise<void>;
  init: () => Promise<void>;
  run: <T = unknown>(request: Request, refresh?: boolean) => Promise<T>;
  navigate: (page: Page, id?: string) => void;
  edit: (table: Table, row?: Row, defaults?: Record<string, unknown>) => void;
  notify: (message: string) => void;
}
let toastTimeout: ReturnType<typeof setTimeout>;
export const useApp = create<Store>((set, get) => ({
  state: null,
  auth: null,
  page: "dashboard",
  selected: "",
  toast: "",
  searchOpen: false,
  smartOpen: false,
  editor: null,
  init: async () => {
    try {
      set({
        auth: await get().run<AuthState>({ action: "authStatus" }, false),
      });
    } catch (e) {
      get().notify(String(e));
    }
  },
  refresh: async () => {
    const auth = get().auth;
    const state = await get().run<State>({ action: "snapshot" }, false);
    if (get().state && get().auth === auth) set({ state });
  },
  run: async <T>(request: Request, refresh = true): Promise<T> => {
    const response = await window.dashboard.call(request);
    if (!response.ok) {
      get().notify(response.error);
      throw new Error(response.error);
    }
    if (refresh && get().state) await get().refresh();
    return response.value as T;
  },
  navigate: (page, id = "") => set({ page, selected: id }),
  edit: (table, row, defaults) => set({ editor: { table, row, defaults } }),
  notify: (message) => {
    clearTimeout(toastTimeout);
    set({ toast: message });
    toastTimeout = setTimeout(() => set({ toast: "" }), 5000);
  },
}));
export const useData = () => useApp((s) => s.state?.data) ?? emptyData();
export const active = <T extends Table>(rows: Row<T>[]) =>
  rows.filter((r) => !r.deleted_at);
export async function action(request: Request, success?: string) {
  try {
    const result = await useApp.getState().run(request);
    if (success && result !== false) useApp.getState().notify(success);
    return result;
  } catch {
    return undefined;
  }
}
