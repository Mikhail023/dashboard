import { useState } from "react";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useApp, action } from "../store";
import type { State } from "../../shared/model";
import { Button, IconButton } from "../components/UI";
import BrandLogo from "../components/BrandLogo";
export default function Auth() {
  const auth = useApp((s) => s.auth);
  const creating = !auth?.profile;
  const [show, setShow] = useState(false),
    [busy, setBusy] = useState(false);
  const schema = z
    .object({
      name: creating ? z.string().min(1, "Укажите имя") : z.string(),
      email: z.union([z.email("Проверьте email"), z.literal("")]),
      avatar_path: z.string(),
      password: z
        .string()
        .min(
          creating ? 8 : 1,
          creating ? "Минимум 8 символов" : "Введите пароль",
        ),
      repeat: z.string(),
    })
    .refine((d) => !creating || d.password === d.repeat, {
      message: "Пароли не совпадают",
      path: ["repeat"],
    });
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      email: "",
      avatar_path: "🌿",
      password: "",
      repeat: "",
    },
  });
  const password = watch("password");
  async function enter(values: z.infer<typeof schema>) {
    setBusy(true);
    try {
      const state = await useApp
        .getState()
        .run<State>(
          creating
            ? { action: "register", data: values }
            : { action: "login", password: values.password },
          false,
        );
      useApp.setState({
        state,
        auth: {
          profile: state.profile,
          authenticated: true,
          retryAfter: 0,
          theme: state.settings.theme ?? "system",
        },
      });
    } catch {
      /* toast */
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-screen">
      <div className="auth-brand">
        <span className="logo logo-image">
          <BrandLogo />
        </span>{" "}
        Dashboard
      </div>
      <div className="auth-card">
        <div className="auth-avatar">
          {creating ? "🌿" : auth?.profile?.avatar_path}
        </div>
        <h1>
          {creating
            ? "Ваше личное пространство"
            : `С возвращением, ${auth?.profile?.name}`}
        </h1>
        <p>
          {creating
            ? "Проекты, идеи и планы. Всё рядом. Всё на вашем устройстве."
            : "Введите пароль, чтобы продолжить свой день."}
        </p>
        <form onSubmit={handleSubmit(enter)}>
          {creating && (
            <>
              <label>
                Как вас зовут
                <input autoFocus autoComplete="name" {...register("name")} />
              </label>
              <label>
                Email · необязательно
                <input
                  type="email"
                  autoComplete="email"
                  {...register("email")}
                />
              </label>
              <label>
                Аватар
                <select {...register("avatar_path")}>
                  {["🌿", "🧑‍💻", "🌞", "🌸", "🦊", "🐱", "🚀"].map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label>
            Пароль
            <div className="password-field">
              <input
                autoFocus={!creating}
                type={show ? "text" : "password"}
                autoComplete={creating ? "new-password" : "current-password"}
                {...register("password")}
              />
              <IconButton
                type="button"
                label={show ? "Скрыть пароль" : "Показать пароль"}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </IconButton>
            </div>
          </label>
          {creating && (
            <>
              <div className="strength">
                <i
                  style={{
                    width: `${Math.min(100, password.length * 6 + (/[0-9]/.test(password) ? 15 : 0))}%`,
                  }}
                />
              </div>
              <label>
                Повторите пароль
                <input
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  {...register("repeat")}
                />
              </label>
            </>
          )}
          {Object.values(errors).map((e, i) => (
            <p className="error" key={i}>
              {e.message}
            </p>
          ))}
          <Button disabled={busy} className="full-width">
            {busy ? "Проверяем…" : creating ? "Создать профиль" : "Войти"}
            <ArrowRight size={18} />
          </Button>
        </form>
        {!creating && (
          <div className="auth-options">
            <button
              onClick={async () => {
                const state = (await action({ action: "touchID" })) as
                  State | undefined;
                if (state) useApp.setState({ state });
              }}
            >
              Войти с Touch ID
            </button>
            <button
              onClick={() => {
                const confirmation = window.prompt(
                  "Сброс пароля удалит профиль и все данные. Резервные копии сохранятся. Для продолжения введите: УДАЛИТЬ ВСЕ ДАННЫЕ",
                );
                if (confirmation)
                  void action({ action: "reset", confirmation }).then(() =>
                    useApp.getState().init(),
                  );
              }}
            >
              Забыли пароль?
            </button>
          </div>
        )}
        <div className="auth-safe">
          <ShieldCheck size={15} /> Данные хранятся только на этом устройстве
        </div>
      </div>
      <span className="auth-bottom">
        <LockKeyhole size={13} /> Ваш день. Ваш ритм. Ваши данные.
      </span>
    </div>
  );
}
