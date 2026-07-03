"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Filter,
  KeyRound,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserRoundCog,
} from "lucide-react";

import type { Role, SubscriptionTier } from "@/lib/types";
import { cn } from "@/lib/utils";

type AdminUserSummary = {
  id: string;
  email: string;
  role: Role;
  name: string;
  title: string;
  classroomId?: string;
  tokenVersion: number;
  trialExpiresAt?: string;
  subscriptionTier?: SubscriptionTier;
  subscriptionExpiresAt?: string;
  onboardingCompleted?: number;
};

type ApiMessage = { tone: "success" | "error" | "info"; text: string };

const roleLabel: Record<Role, string> = {
  student: "学生",
  teacher: "教师",
  parent: "家长",
  admin: "管理员",
};

const subscriptionLabel: Record<SubscriptionTier, string> = {
  free: "免费 / 试用",
  standard: "标准订阅",
  premium: "学校授权",
};

const roleOptions: Array<{ value: Role | "all"; label: string }> = [
  { value: "all", label: "全部角色" },
  { value: "student", label: "学生" },
  { value: "teacher", label: "教师" },
  { value: "parent", label: "家长" },
  { value: "admin", label: "管理员" },
];

const subscriptionOptions: Array<{ value: SubscriptionTier | "trial" | "all"; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "trial", label: "试用中" },
  { value: "free", label: "免费" },
  { value: "standard", label: "标准订阅" },
  { value: "premium", label: "学校授权" },
];

function formatDate(value?: string) {
  if (!value) return "未设置";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未设置";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(date);
}

function messageClass(tone: ApiMessage["tone"]) {
  if (tone === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (tone === "error") return "border-red-200 bg-red-50 text-red-800";
  return "border-orange-200 bg-orange-50 text-orange-800";
}

async function readPayload<T>(response: Response) {
  try {
    return (await response.json()) as T & { error?: string; message?: string };
  } catch {
    return {} as T & { error?: string; message?: string };
  }
}

export function AdminUserManager({
  users,
  canManagePasswords,
}: {
  users: AdminUserSummary[];
  canManagePasswords: boolean;
}) {
  const [items, setItems] = useState(users);
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [subscriptionFilter, setSubscriptionFilter] = useState<SubscriptionTier | "trial" | "all">("all");
  const [message, setMessage] = useState<ApiMessage | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState(users[0]?.email ?? "");
  const [profileDraft, setProfileDraft] = useState({
    name: users[0]?.name ?? "",
    title: users[0]?.title ?? "",
    role: (users[0]?.role ?? "student") as Role,
    subscriptionTier: (users[0]?.subscriptionTier ?? "free") as SubscriptionTier,
    trialDays: "",
    subscriptionDays: "",
    onboardingCompleted: Boolean(users[0]?.onboardingCompleted),
  });
  const [createDraft, setCreateDraft] = useState({
    name: "",
    email: "",
    password: "",
    role: "student" as Role,
    title: "",
    subscriptionTier: "free" as SubscriptionTier,
    trialDays: "3",
    subscriptionDays: "",
  });

  const selectedUser = useMemo(
    () => items.find((user) => user.id === selectedUserId) ?? items[0],
    [items, selectedUserId],
  );

  useEffect(() => {
    if (!selectedUser) return;
    setSelectedUserId(selectedUser.id);
    setEmail(selectedUser.email);
    setProfileDraft({
      name: selectedUser.name,
      title: selectedUser.title,
      role: selectedUser.role,
      subscriptionTier: selectedUser.subscriptionTier ?? "free",
      trialDays: "",
      subscriptionDays: "",
      onboardingCompleted: Boolean(selectedUser.onboardingCompleted),
    });
  }, [selectedUser]);

  async function refreshUsers(nextFilters = { query, role: roleFilter, subscription: subscriptionFilter }) {
    setBusyAction("refresh");
    setMessage(null);
    try {
      const params = new URLSearchParams();
      if (nextFilters.query.trim()) params.set("query", nextFilters.query.trim());
      params.set("role", nextFilters.role);
      params.set("subscription", nextFilters.subscription);
      const response = await fetch(`/api/admin/users?${params.toString()}`);
      const payload = await readPayload<{ users?: AdminUserSummary[] }>(response);
      if (!response.ok) throw new Error(payload.message ?? "账号列表读取失败。");
      const nextUsers = payload.users ?? [];
      setItems(nextUsers);
      if (!nextUsers.some((user) => user.id === selectedUserId)) {
        setSelectedUserId(nextUsers[0]?.id ?? "");
      }
      setMessage({ tone: "success", text: "账号列表已刷新。" });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "账号列表读取失败。" });
    } finally {
      setBusyAction(null);
    }
  }

  async function createUser() {
    if (!canManagePasswords) {
      setMessage({ tone: "error", text: "当前账号为只读模式，不能创建账号。" });
      return;
    }
    setBusyAction("create");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...createDraft,
          trialDays: createDraft.trialDays === "" ? null : Number(createDraft.trialDays),
          subscriptionDays: createDraft.subscriptionDays === "" ? null : Number(createDraft.subscriptionDays),
        }),
      });
      const payload = await readPayload<{ user?: AdminUserSummary }>(response);
      if (!response.ok) throw new Error(payload.message ?? "账号创建失败。");
      if (payload.user) {
        setItems((current) => [payload.user!, ...current]);
        setSelectedUserId(payload.user.id);
      }
      setCreateDraft({
        name: "",
        email: "",
        password: "",
        role: "student",
        title: "",
        subscriptionTier: "free",
        trialDays: "3",
        subscriptionDays: "",
      });
      setMessage({ tone: "success", text: payload.message ?? "账号已创建。" });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "账号创建失败。" });
    } finally {
      setBusyAction(null);
    }
  }

  async function updateProfile() {
    if (!selectedUser) return;
    if (!canManagePasswords) {
      setMessage({ tone: "error", text: "当前账号为只读模式，不能修改账号配置。" });
      return;
    }
    setBusyAction("profile");
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: profileDraft.name,
          title: profileDraft.title,
          role: profileDraft.role,
          subscriptionTier: profileDraft.subscriptionTier,
          trialDays: profileDraft.trialDays === "" ? undefined : Number(profileDraft.trialDays),
          subscriptionDays:
            profileDraft.subscriptionDays === "" ? undefined : Number(profileDraft.subscriptionDays),
          onboardingCompleted: profileDraft.onboardingCompleted,
        }),
      });
      const payload = await readPayload<{ user?: AdminUserSummary }>(response);
      if (!response.ok) throw new Error(payload.message ?? "账号配置更新失败。");
      if (payload.user) {
        setItems((current) => current.map((user) => (user.id === payload.user!.id ? payload.user! : user)));
      }
      setMessage({ tone: "success", text: payload.message ?? "账号配置已更新。" });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "账号配置更新失败。" });
    } finally {
      setBusyAction(null);
    }
  }

  async function submitPasswordReset() {
    if (!selectedUser) return;
    if (!canManagePasswords) {
      setMessage({ tone: "error", text: "当前账号不是超级管理员，不能重置密码。" });
      return;
    }
    if (password.length < 8) {
      setMessage({ tone: "error", text: "请输入不少于 8 位的新密码。" });
      return;
    }

    setBusyAction("password");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, password }),
      });
      const payload = await readPayload<{ user?: AdminUserSummary }>(response);
      if (!response.ok) throw new Error(payload.message ?? "密码更新失败。");
      setPassword("");
      setMessage({ tone: "success", text: payload.message ?? "密码已更新，旧会话已失效。" });
      void refreshUsers();
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "密码更新失败。" });
    } finally {
      setBusyAction(null);
    }
  }

  async function submitEmailUpdate() {
    if (!selectedUser) return;
    if (!canManagePasswords) {
      setMessage({ tone: "error", text: "当前账号不是超级管理员，不能修改邮箱。" });
      return;
    }
    if (!email.includes("@") && email !== "superadmin") {
      setMessage({ tone: "error", text: "请输入有效邮箱，或保留超级管理员账号 superadmin。" });
      return;
    }

    setBusyAction("email");
    setMessage(null);
    try {
      const response = await fetch("/api/admin/users/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, email }),
      });
      const payload = await readPayload<{ user?: AdminUserSummary }>(response);
      if (!response.ok) throw new Error(payload.message ?? "邮箱更新失败。");
      if (payload.user) {
        setItems((current) => current.map((user) => (user.id === payload.user!.id ? { ...user, ...payload.user! } : user)));
      }
      setMessage({ tone: "success", text: payload.message ?? "邮箱已更新，旧会话已失效。" });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "邮箱更新失败。" });
    } finally {
      setBusyAction(null);
    }
  }

  const visibleCount = items.length;

  return (
    <section data-motion-reveal className="panel rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="bz-eyebrow">SUPER ADMIN</p>
          <h2 className="mt-3 text-3xl font-black text-slate-950">账号、试用与订阅管理</h2>
          <p className="mt-2 max-w-3xl text-base font-semibold leading-8 text-slate-600">
            超级管理员可以创建账号、修改邮箱、重置密码、调整角色与订阅状态。普通管理员保留只读视图，避免误改课堂数据。
          </p>
        </div>
        <div
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-black",
            canManagePasswords ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-500",
          )}
        >
          <ShieldCheck className="h-4 w-4" />
          {canManagePasswords ? "超级管理员写权限" : "只读模式"}
        </div>
      </div>

      <div className="mt-6 grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white/80 p-3 lg:grid-cols-[minmax(0,1fr)_minmax(160px,1fr)_minmax(160px,1fr)_auto]">
        <label className="flex min-h-12 items-center gap-3 rounded-2xl bg-slate-50 px-4">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索姓名、邮箱或备注"
            className="w-full bg-transparent text-sm font-semibold outline-none placeholder:text-slate-400"
          />
        </label>
        <label className="flex min-h-12 items-center gap-2 rounded-2xl bg-slate-50 px-3">
          <Filter className="h-4 w-4 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as Role | "all")}
            className="w-full bg-transparent text-sm font-black outline-none"
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <select
          value={subscriptionFilter}
          onChange={(event) => setSubscriptionFilter(event.target.value as SubscriptionTier | "trial" | "all")}
          className="min-h-12 rounded-2xl bg-slate-50 px-3 text-sm font-black outline-none"
        >
          {subscriptionOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-motion-button
          onClick={() => void refreshUsers()}
          disabled={Boolean(busyAction)}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
        >
          <RefreshCw className={cn("h-4 w-4", busyAction === "refresh" && "animate-spin")} />
          查询 {visibleCount}
        </button>
      </div>

      <div className="mt-6 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.86fr)]">
        <div className="grid max-h-[720px] gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-2">
          {items.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm font-semibold text-slate-500 md:col-span-2">
              暂无匹配账号，请调整筛选条件。
            </div>
          ) : (
            items.map((user) => {
              const active = selectedUser?.id === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  data-motion-card
                  onClick={() => setSelectedUserId(user.id)}
                  className={cn(
                    "min-h-[128px] rounded-[1.5rem] border p-4 text-left transition-all hover:-translate-y-0.5",
                    active
                      ? "border-orange-400 bg-orange-50 shadow-[0_18px_42px_rgba(240,138,56,0.14)]"
                      : "border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-white",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="line-clamp-2 break-words text-lg font-black text-slate-950">{user.name}</p>
                      <p className="mt-1 break-all text-sm font-semibold text-slate-500">{user.email}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                      {roleLabel[user.role]}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold text-slate-500" title={user.title}>{user.title}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-black">
                    <span className="rounded-full bg-white px-3 py-1 text-slate-500">
                      {subscriptionLabel[user.subscriptionTier ?? "free"]}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1 text-slate-500">
                      TV {user.tokenVersion}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <div data-motion-card className="rounded-[1.7rem] border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <UserRoundCog className="h-5 w-5 text-orange-500" />
              <h3 className="text-2xl font-black text-slate-950">选中账号</h3>
            </div>

            {selectedUser ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <InfoTile label="邮箱" value={selectedUser.email} />
                  <InfoTile label="角色" value={roleLabel[selectedUser.role]} />
                  <InfoTile label="试用到期" value={formatDate(selectedUser.trialExpiresAt)} />
                  <InfoTile label="订阅到期" value={formatDate(selectedUser.subscriptionExpiresAt)} />
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">姓名</span>
                    <input
                      value={profileDraft.name}
                      onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))}
                      disabled={!canManagePasswords}
                      className="bz-field min-h-12"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">备注 / 标题</span>
                    <input
                      value={profileDraft.title}
                      onChange={(event) => setProfileDraft((current) => ({ ...current, title: event.target.value }))}
                      disabled={!canManagePasswords}
                      className="bz-field min-h-12"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">角色</span>
                    <select
                      value={profileDraft.role}
                      onChange={(event) => setProfileDraft((current) => ({ ...current, role: event.target.value as Role }))}
                      disabled={!canManagePasswords}
                      className="bz-field min-h-12"
                    >
                      {roleOptions
                        .filter((option): option is { value: Role; label: string } => option.value !== "all")
                        .map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">订阅状态</span>
                    <select
                      value={profileDraft.subscriptionTier}
                      onChange={(event) =>
                        setProfileDraft((current) => ({ ...current, subscriptionTier: event.target.value as SubscriptionTier }))
                      }
                      disabled={!canManagePasswords}
                      className="bz-field min-h-12"
                    >
                      {(["free", "standard", "premium"] as SubscriptionTier[]).map((tier) => (
                        <option key={tier} value={tier}>
                          {subscriptionLabel[tier]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">延长试用天数</span>
                    <input
                      value={profileDraft.trialDays}
                      onChange={(event) => setProfileDraft((current) => ({ ...current, trialDays: event.target.value }))}
                      disabled={!canManagePasswords}
                      inputMode="numeric"
                      placeholder="留空表示不变"
                      className="bz-field min-h-12"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-bold text-slate-700">开通订阅天数</span>
                    <input
                      value={profileDraft.subscriptionDays}
                      onChange={(event) => setProfileDraft((current) => ({ ...current, subscriptionDays: event.target.value }))}
                      disabled={!canManagePasswords}
                      inputMode="numeric"
                      placeholder="如 30"
                      className="bz-field min-h-12"
                    />
                  </label>
                </div>

                <label className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700">
                  <input
                    type="checkbox"
                    checked={profileDraft.onboardingCompleted}
                    onChange={(event) =>
                      setProfileDraft((current) => ({ ...current, onboardingCompleted: event.target.checked }))
                    }
                    disabled={!canManagePasswords}
                    className="h-4 w-4 accent-orange-500"
                  />
                  标记为已完成新手教学
                </label>

                <button
                  type="button"
                  data-motion-button
                  onClick={() => void updateProfile()}
                  disabled={Boolean(busyAction) || !canManagePasswords}
                  className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-base font-black text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {busyAction === "profile" ? "正在保存..." : "保存账号配置"}
                </button>
              </>
            ) : (
              <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                请先选择一个账号。
              </p>
            )}
          </div>

          <div data-motion-card className="rounded-[1.7rem] border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-orange-500" />
              <h3 className="text-xl font-black text-slate-950">邮箱与密码</h3>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">新邮箱</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="text"
                  disabled={!canManagePasswords}
                  className="bz-field min-h-12"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">新密码</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="至少 8 位"
                  disabled={!canManagePasswords}
                  className="bz-field min-h-12"
                />
              </label>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                data-motion-button
                onClick={() => void submitEmailUpdate()}
                disabled={Boolean(busyAction) || !canManagePasswords}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-5 text-sm font-black text-orange-700 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                <Mail className="h-4 w-4" />
                {busyAction === "email" ? "正在更新..." : "修改邮箱"}
              </button>
              <button
                type="button"
                data-motion-button
                onClick={() => void submitPasswordReset()}
                disabled={Boolean(busyAction) || !canManagePasswords}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-5 text-sm font-black text-slate-800 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                <KeyRound className="h-4 w-4" />
                {busyAction === "password" ? "正在重置..." : "重置密码"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div data-motion-card className="mt-6 rounded-[1.7rem] border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <Plus className="h-5 w-5 text-orange-500" />
          <h3 className="text-2xl font-black text-slate-950">创建账号</h3>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <input
            value={createDraft.name}
            onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="姓名"
            disabled={!canManagePasswords}
            className="bz-field min-h-12"
          />
          <input
            value={createDraft.email}
            onChange={(event) => setCreateDraft((current) => ({ ...current, email: event.target.value }))}
            placeholder="邮箱"
            disabled={!canManagePasswords}
            className="bz-field min-h-12 md:col-span-2 xl:col-span-1"
          />
          <input
            value={createDraft.password}
            onChange={(event) => setCreateDraft((current) => ({ ...current, password: event.target.value }))}
            placeholder="初始密码"
            type="password"
            disabled={!canManagePasswords}
            className="bz-field min-h-12"
          />
          <select
            value={createDraft.role}
            onChange={(event) => setCreateDraft((current) => ({ ...current, role: event.target.value as Role }))}
            disabled={!canManagePasswords}
            className="bz-field min-h-12"
          >
            {roleOptions
              .filter((option): option is { value: Role; label: string } => option.value !== "all")
              .map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
          </select>
          <select
            value={createDraft.subscriptionTier}
            onChange={(event) => setCreateDraft((current) => ({ ...current, subscriptionTier: event.target.value as SubscriptionTier }))}
            disabled={!canManagePasswords}
            className="bz-field min-h-12"
          >
            {(["free", "standard", "premium"] as SubscriptionTier[]).map((tier) => (
              <option key={tier} value={tier}>
                {subscriptionLabel[tier]}
              </option>
            ))}
          </select>
          <input
            value={createDraft.trialDays}
            onChange={(event) => setCreateDraft((current) => ({ ...current, trialDays: event.target.value }))}
            placeholder="试用天数"
            inputMode="numeric"
            disabled={!canManagePasswords}
            className="bz-field min-h-12"
          />
          <button
            type="button"
            data-motion-button
            onClick={() => void createUser()}
            disabled={Boolean(busyAction) || !canManagePasswords}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-orange-400 px-5 text-sm font-black text-slate-950 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            <BadgeCheck className="h-4 w-4" />
            {busyAction === "create" ? "创建中..." : "创建"}
          </button>
        </div>
      </div>

      {message ? (
        <p className={`mt-5 rounded-2xl border px-5 py-4 text-sm font-bold leading-6 ${messageClass(message.tone)}`}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 break-all text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}
