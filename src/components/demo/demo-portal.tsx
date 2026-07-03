"use client";

import {
  ArrowRight,
  BadgeCheck,
  Check,
  LockKeyhole,
  Sparkles,
  UserPlus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useMemo, useRef, useState } from "react";

import {
  passwordRequirements,
  registerFieldErrors,
  type RegisterField,
} from "@/lib/auth-validation";
import { useFocusTrap } from "@/lib/use-focus-trap";

type Credentials = { label: string; email: string; trial?: boolean };
type InviteHint = { role: string; code: string; note: string };

type AuthMode = "login" | "register" | "invite";

type FormMessage = {
  tone: "success" | "error" | "info";
  text: string;
};

function messageClass(tone: FormMessage["tone"]) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "error") return "border-red-200 bg-red-50 text-red-800";
  return "border-orange-200 bg-orange-50 text-orange-800";
}

async function readPayload(response: Response) {
  try {
    return (await response.json()) as {
      error?: string;
      message?: string;
      redirectTo?: string;
      resetUrl?: string;
    };
  } catch {
    return {};
  }
}

function normalizeLoginError(message?: string) {
  if (!message) return "账号或密码错误，请重新输入。";
  if (/请求参数格式|invalid_input|请输入有效邮箱|邮箱格式|password/i.test(message)) {
    return "账号或密码错误，请重新输入。";
  }
  return message;
}

export function DemoPortal({
  credentials,
  inviteHints,
}: {
  credentials: Credentials[];
  inviteHints: InviteHint[];
}) {
  const router = useRouter();
  const [activeModal, setActiveModal] = useState<AuthMode | null>(null);
  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
    inviteCode: "",
  });
  const [inviteForm, setInviteForm] = useState({
    name: "体验用户",
    email: "newuser@brownzone.ai",
    password: "BrownZone2026!",
    inviteCode: inviteHints[0]?.code ?? "",
  });
  const [registerErrors, setRegisterErrors] = useState<Partial<Record<RegisterField, string>>>({});
  const [message, setMessage] = useState<FormMessage | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  // Update a register field and clear that field's error the moment the user
  // starts correcting it, so the inline hint disappears as soon as it's stale.
  function updateRegisterField(field: keyof typeof registerForm, value: string) {
    setRegisterForm((current) => ({ ...current, [field]: value }));
    setRegisterErrors((current) => {
      if (current[field] === undefined) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("auth");
    if (mode === "login" || mode === "register" || mode === "invite") {
      setActiveModal(mode);
    }
    const verify = params.get("verify");
    if (verify === "success") {
      setMessage({ tone: "success", text: "邮箱验证成功，已激活完整功能。" });
    } else if (verify === "invalid") {
      setMessage({ tone: "error", text: "验证链接无效或已过期，请重新发起。" });
    } else if (verify === "error") {
      setMessage({ tone: "error", text: "邮箱验证失败，请稍后重试。" });
    }
  }, []);

  useEffect(() => {
    document.body.dataset.scrollLocked = activeModal ? "true" : "false";
    return () => {
      delete document.body.dataset.scrollLocked;
    };
  }, [activeModal]);

  const trialCredential = useMemo(
    () =>
      credentials.find((item) => item.trial) ?? {
        label: "游客试玩",
        email: "guest@brownzone.ai",
        trial: true,
      },
    [credentials],
  );

  const demoCredentials = useMemo(
    () => credentials.filter((item) => !item.trial),
    [credentials],
  );

  function openModal(mode: AuthMode) {
    setMessage(null);
    setRegisterErrors({});
    setActiveModal(mode);
  }

  function closeModal() {
    if (busyAction) return;
    setActiveModal(null);
    setMessage(null);
    setRegisterErrors({});
  }

  // A11y: full modal keyboard contract — focus-in, Tab-trap, Esc, focus-restore.
  // closeModal already no-ops while a submit is in flight.
  const dialogRef = useRef<HTMLElement>(null);
  useFocusTrap(Boolean(activeModal), dialogRef, closeModal);

  function redirectAfterLogin(path = "/demo") {
    startTransition(() => {
      router.push(path);
      router.refresh();
    });
  }

  async function submitLogin(nextLogin = loginForm, actionLabel = "login") {
    setBusyAction(actionLabel);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(nextLogin),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(normalizeLoginError(payload.message));
      }

      setMessage({ tone: "success", text: payload.message ?? "登录成功，正在进入对应工作台。" });
      redirectAfterLogin(payload.redirectTo ?? "/demo");
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "登录失败，请稍后重试。" });
    } finally {
      setBusyAction(null);
    }
  }

  async function submitForgot() {
    if (!loginForm.email.trim()) {
      setMessage({ tone: "info", text: "请先在上方填写注册邮箱，再点击找回密码。" });
      return;
    }
    setBusyAction("forgot");
    setMessage(null);
    try {
      const response = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: loginForm.email.trim() }),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(payload.message ?? "发起找回密码失败，请稍后重试。");
      }
      // Dev convenience: when no email provider is configured the API returns the
      // link directly so it can be opened without an inbox.
      if (payload.resetUrl) {
        setMessage({ tone: "info", text: `重置链接已生成（开发环境直接返回）：${payload.resetUrl}` });
      } else {
        setMessage({ tone: "success", text: payload.message ?? "如果该邮箱已注册，重置链接已发送，请查收邮箱。" });
      }
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "发起找回密码失败，请稍后重试。" });
    } finally {
      setBusyAction(null);
    }
  }

  async function submitCredential(item: Credentials) {
    if (item.trial) {
      const key = "brown-zone-guest-trial-count";
      const nextCount = Number(window.localStorage.getItem(key) ?? "0") + 1;
      if (nextCount > 3) {
        setMessage({
          tone: "info",
          text: "游客试玩次数已达上限。请使用邮箱注册或登录正式账号继续体验完整沙盘。",
        });
        return;
      }
      window.localStorage.setItem(key, String(nextCount));
    }

    // Demo passwords stay server-side: send email only; the server looks up the
    // built-in demo password and establishes the session.
    setBusyAction(item.trial ? "guest" : `credential-${item.email}`);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: item.email }),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(normalizeLoginError(payload.message));
      }
      setMessage({ tone: "success", text: payload.message ?? "正在进入演示账号。" });
      redirectAfterLogin(payload.redirectTo ?? "/demo");
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "登录失败，请稍后重试。" });
    } finally {
      setBusyAction(null);
    }
  }

  async function submitInvite() {
    setBusyAction("invite");
    setMessage(null);

    try {
      const response = await fetch("/api/auth/register-by-invite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(inviteForm),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(payload.message ?? "邀请码注册失败，请检查邀请码是否有效。");
      }

      setMessage({ tone: "success", text: payload.message ?? "邀请码注册完成，正在进入对应工作台。" });
      redirectAfterLogin(payload.redirectTo ?? "/demo");
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "邀请码注册失败，请稍后重试。" });
    } finally {
      setBusyAction(null);
    }
  }

  async function submitRegister() {
    const requestBody = {
      name: registerForm.name,
      email: registerForm.email,
      password: registerForm.password,
      inviteCode: registerForm.inviteCode || undefined,
    };

    // Validate against the same schema the server uses, BEFORE the network call:
    // the user gets the specific reason next to each field instantly, and a
    // malformed attempt never counts against the registration rate limit.
    const fieldErrors = registerFieldErrors(requestBody);
    if (Object.keys(fieldErrors).length > 0) {
      setRegisterErrors(fieldErrors);
      setMessage(null);
      return;
    }
    setRegisterErrors({});

    setBusyAction("register");
    setMessage(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = await readPayload(response);
      if (!response.ok) {
        throw new Error(payload.message ?? "注册失败，请检查邮箱和密码格式。");
      }

      setMessage({ tone: "success", text: payload.message ?? "注册成功，正在进入沙盘体验。" });
      redirectAfterLogin(payload.redirectTo ?? "/student");
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "注册失败，请稍后重试。" });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="panel relative overflow-hidden rounded-[2rem] p-6 shadow-[0_28px_90px_rgba(15,23,42,0.08)] sm:p-8">
          <div className="absolute right-6 top-6 hidden h-24 w-24 rounded-full bg-orange-200/40 blur-3xl md:block" />
          <p className="bz-eyebrow">Access Center</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            一个清爽入口，按你的身份进入 Brown Zone。
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600">
            登录窗口会单独弹出，页面本身保持轻盈。已有账号直接进入工作台，新用户可注册体验，游客可先轻量试玩。
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <button
              type="button"
              data-motion-card
              onClick={() => openModal("login")}
              className="group rounded-[1.5rem] border border-slate-200 bg-slate-950 p-5 text-left text-white shadow-[0_20px_54px_rgba(15,23,42,0.18)] transition-all hover:-translate-y-1"
            >
              <LockKeyhole className="h-5 w-5 text-orange-300" />
              <p className="mt-5 text-xl font-black">登录账号</p>
              <p className="mt-2 text-sm leading-6 text-white/62">已有账号从这里进入。</p>
            </button>
            <button
              type="button"
              data-motion-card
              onClick={() => openModal("register")}
              className="rounded-[1.5rem] border border-orange-200 bg-orange-50 p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(240,138,56,0.16)]"
            >
              <UserPlus className="h-5 w-5 text-orange-600" />
              <p className="mt-5 text-xl font-black text-slate-950">注册体验</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">用邮箱创建普通体验账号。</p>
            </button>
            <button
              type="button"
              data-motion-card
              onClick={() => void submitCredential(trialCredential)}
              disabled={Boolean(busyAction)}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:border-orange-200 disabled:opacity-60"
            >
              <Sparkles className="h-5 w-5 text-orange-500" />
              <p className="mt-5 text-xl font-black text-slate-950">游客体验</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {busyAction === "guest" ? "正在进入体验..." : "不注册先感受核心流程。"}
              </p>
            </button>
          </div>
        </div>

        <div className="grid gap-5">
          <div className="panel rounded-[2rem] p-6 sm:p-8">
            <p className="bz-eyebrow">Classroom Code</p>
            <h2 className="mt-3 text-3xl font-black text-slate-950">邀请码加入</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              如果学校、教师或家长已经发放邀请码，可以从这里绑定到对应班级或角色。
            </p>
            <button
              type="button"
              data-motion-button
              onClick={() => openModal("invite")}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-6 text-sm font-black text-slate-950 transition-all hover:-translate-y-0.5 hover:border-orange-200"
            >
              使用邀请码
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

          <div className="rounded-[2rem] border border-slate-200/70 bg-white/70 p-6 shadow-[0_26px_80px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-black text-slate-700">
              <BadgeCheck className="h-4 w-4 text-orange-500" />
              演示账号
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {demoCredentials.map((item) => (
                <button
                  key={item.email}
                  type="button"
                  data-motion-card
                  onClick={() => void submitCredential(item)}
                  disabled={Boolean(busyAction)}
                  className="rounded-[1.2rem] border border-slate-100 bg-white px-4 py-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-200 disabled:opacity-60"
                >
                  <p className="text-base font-black text-slate-950">{item.label}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-500" title={item.email}>{item.email}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {message && !activeModal ? (
        <p className={`break-all rounded-2xl border px-5 py-4 text-sm font-bold leading-6 ${messageClass(message.tone)}`}>
          {message.text}
        </p>
      ) : null}

      {activeModal ? (
          <div
            data-motion-overlay
            className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-slate-950/54 px-4 py-6 backdrop-blur-md"
          >
            <button
              type="button"
              aria-label="关闭登录窗口"
              className="absolute inset-0 cursor-default"
              onClick={closeModal}
            />
            <section
              ref={dialogRef}
              data-motion-modal
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="demo-auth-title"
              className="relative w-full max-w-[760px] overflow-hidden rounded-[2.25rem] border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_48%,#fff6ec_100%)] p-5 shadow-[0_34px_120px_rgba(15,23,42,0.32)] focus:outline-none sm:p-7"
            >
              <div className="absolute -right-14 -top-14 h-44 w-44 rounded-full bg-orange-200/50 blur-3xl" />
              <div className="absolute -bottom-20 left-10 h-52 w-52 rounded-full bg-slate-200/70 blur-3xl" />
              <button
                type="button"
                data-motion-button
                onClick={closeModal}
                className="absolute right-5 top-5 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition-colors hover:text-slate-950"
                aria-label="关闭登录窗口"
              >
                <X className="h-5 w-5" />
              </button>

              {activeModal === "login" ? (
                <div className="relative">
                  <p className="bz-eyebrow">Email Login</p>
                  <h2 id="demo-auth-title" className="mt-3 text-4xl font-black tracking-tight text-slate-950">
                    邮箱登录
                  </h2>
                  <p className="mt-3 max-w-2xl text-base leading-8 text-slate-600">
                    输入账号与密码，系统会根据角色自动进入对应工作台。
                  </p>
                  <div className="mt-7 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">邮箱 / 账号</span>
                      <input
                        name="email"
                        autoComplete="username"
                        placeholder="your@email.com"
                        value={loginForm.email}
                        onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                        className="bz-field min-h-13 rounded-[1.2rem] bg-white/86"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">密码</span>
                      <input
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="请输入密码"
                        value={loginForm.password}
                        onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                        className="bz-field min-h-13 rounded-[1.2rem] bg-white/86"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    data-motion-button
                    onClick={() => void submitLogin()}
                    disabled={Boolean(busyAction)}
                    className="bz-primary-action mt-6 inline-flex min-h-13 w-full items-center justify-center gap-2 px-6 text-base disabled:opacity-60 sm:w-auto"
                  >
                    <LockKeyhole className="h-4 w-4" />
                    {busyAction === "login" ? "正在登录..." : "登录并进入工作台"}
                  </button>
                  <button
                    type="button"
                    data-motion-button
                    onClick={() => void submitForgot()}
                    disabled={Boolean(busyAction)}
                    className="mt-3 block text-sm font-semibold text-slate-500 underline-offset-4 transition-colors hover:text-slate-800 hover:underline disabled:opacity-60"
                  >
                    {busyAction === "forgot" ? "正在发送..." : "忘记密码？"}
                  </button>
                </div>
              ) : null}

              {activeModal === "register" ? (
                <div className="relative">
                  <p className="bz-eyebrow">Register</p>
                  <h2 id="demo-auth-title" className="mt-3 text-4xl font-black tracking-tight text-slate-950">
                    注册体验账号
                  </h2>
                  <p className="mt-3 max-w-2xl text-base leading-8 text-slate-600">
                    一个邮箱只能注册一个账号。没有邀请码时会创建普通体验账号。
                  </p>
                  <div className="mt-7 grid items-start gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">昵称</span>
                      <input
                        placeholder="2-16 个字"
                        value={registerForm.name}
                        onChange={(event) => updateRegisterField("name", event.target.value)}
                        aria-invalid={Boolean(registerErrors.name)}
                        aria-describedby={registerErrors.name ? "register-name-error" : undefined}
                        className="bz-field min-h-13 rounded-[1.2rem] bg-white/86"
                      />
                      {registerErrors.name ? (
                        <p
                          id="register-name-error"
                          role="alert"
                          className="mt-1.5 text-xs font-semibold"
                          style={{ color: "var(--color-error)" }}
                        >
                          {registerErrors.name}
                        </p>
                      ) : null}
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">邮箱</span>
                      <input
                        type="email"
                        placeholder="your@email.com"
                        autoComplete="email"
                        value={registerForm.email}
                        onChange={(event) => updateRegisterField("email", event.target.value)}
                        aria-invalid={Boolean(registerErrors.email)}
                        aria-describedby={registerErrors.email ? "register-email-error" : undefined}
                        className="bz-field min-h-13 rounded-[1.2rem] bg-white/86"
                      />
                      {registerErrors.email ? (
                        <p
                          id="register-email-error"
                          role="alert"
                          className="mt-1.5 text-xs font-semibold"
                          style={{ color: "var(--color-error)" }}
                        >
                          {registerErrors.email}
                        </p>
                      ) : null}
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">密码</span>
                      <input
                        type="password"
                        placeholder="设置登录密码"
                        autoComplete="new-password"
                        value={registerForm.password}
                        onChange={(event) => updateRegisterField("password", event.target.value)}
                        aria-invalid={Boolean(registerErrors.password)}
                        aria-describedby={`register-password-reqs${registerErrors.password ? " register-password-error" : ""}`}
                        className="bz-field min-h-13 rounded-[1.2rem] bg-white/86"
                      />
                      <ul id="register-password-reqs" className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        {passwordRequirements.map((requirement) => {
                          const met = requirement.test(registerForm.password);
                          return (
                            <li
                              key={requirement.label}
                              className={`inline-flex items-center gap-1 text-xs font-semibold transition-colors ${met ? "text-emerald-700" : "text-slate-500"}`}
                            >
                              {met ? (
                                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                              ) : (
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-300" aria-hidden="true" />
                              )}
                              {requirement.label}
                            </li>
                          );
                        })}
                      </ul>
                      {registerErrors.password ? (
                        <p
                          id="register-password-error"
                          role="alert"
                          className="mt-1.5 text-xs font-semibold"
                          style={{ color: "var(--color-error)" }}
                        >
                          {registerErrors.password}
                        </p>
                      ) : null}
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">邀请码（可选）</span>
                      <input
                        placeholder="有邀请码可填写"
                        value={registerForm.inviteCode}
                        onChange={(event) => updateRegisterField("inviteCode", event.target.value)}
                        aria-invalid={Boolean(registerErrors.inviteCode)}
                        aria-describedby={registerErrors.inviteCode ? "register-invite-error" : undefined}
                        className="bz-field min-h-13 rounded-[1.2rem] bg-white/86"
                      />
                      {registerErrors.inviteCode ? (
                        <p
                          id="register-invite-error"
                          role="alert"
                          className="mt-1.5 text-xs font-semibold"
                          style={{ color: "var(--color-error)" }}
                        >
                          {registerErrors.inviteCode}
                        </p>
                      ) : null}
                    </label>
                  </div>
                  <button
                    type="button"
                    data-motion-button
                    onClick={() => void submitRegister()}
                    disabled={Boolean(busyAction)}
                    className="bz-primary-action mt-6 inline-flex min-h-13 w-full items-center justify-center gap-2 px-6 text-base disabled:opacity-60 sm:w-auto"
                  >
                    <UserPlus className="h-4 w-4" />
                    {busyAction === "register" ? "正在注册..." : "注册并开始体验"}
                  </button>
                </div>
              ) : null}

              {activeModal === "invite" ? (
                <div className="relative">
                  <p className="bz-eyebrow">Invite Flow</p>
                  <h2 id="demo-auth-title" className="mt-3 text-4xl font-black tracking-tight text-slate-950">
                    邀请码加入
                  </h2>
                  <p className="mt-3 max-w-2xl text-base leading-8 text-slate-600">
                    选择或输入邀请码，绑定到对应的班级、家校或课堂角色。
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {inviteHints.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => setInviteForm((current) => ({ ...current, inviteCode: item.code }))}
                        className="max-w-full break-all rounded-full border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black text-orange-700"
                      >
                        {item.role} · {item.code}
                      </button>
                    ))}
                  </div>
                  <div className="mt-7 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">姓名</span>
                      <input
                        value={inviteForm.name}
                        onChange={(event) => setInviteForm((current) => ({ ...current, name: event.target.value }))}
                        className="bz-field min-h-13 rounded-[1.2rem] bg-white/86"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">邮箱</span>
                      <input
                        type="email"
                        value={inviteForm.email}
                        onChange={(event) => setInviteForm((current) => ({ ...current, email: event.target.value }))}
                        className="bz-field min-h-13 rounded-[1.2rem] bg-white/86"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">密码</span>
                      <input
                        type="password"
                        value={inviteForm.password}
                        onChange={(event) => setInviteForm((current) => ({ ...current, password: event.target.value }))}
                        className="bz-field min-h-13 rounded-[1.2rem] bg-white/86"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">邀请码</span>
                      <input
                        value={inviteForm.inviteCode}
                        onChange={(event) => setInviteForm((current) => ({ ...current, inviteCode: event.target.value }))}
                        className="bz-field min-h-13 rounded-[1.2rem] bg-white/86"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    data-motion-button
                    onClick={() => void submitInvite()}
                    disabled={Boolean(busyAction)}
                    className="bz-primary-action mt-6 inline-flex min-h-13 w-full items-center justify-center gap-2 px-6 text-base disabled:opacity-60 sm:w-auto"
                  >
                    <ArrowRight className="h-4 w-4" />
                    {busyAction === "invite" ? "正在开通..." : "使用邀请码注册"}
                  </button>
                </div>
              ) : null}

              {message ? (
                <p className={`relative mt-6 break-all rounded-2xl border px-5 py-4 text-sm font-bold leading-6 ${messageClass(message.tone)}`}>
                  {message.text}
                </p>
              ) : null}
            </section>
          </div>
        ) : null}
    </div>
  );
}
