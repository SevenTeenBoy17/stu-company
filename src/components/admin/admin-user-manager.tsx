"use client";

import { useState, useTransition } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";

import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type AdminUserSummary = {
  id: string;
  email: string;
  role: Role;
  name: string;
  title: string;
  classroomId?: string;
  tokenVersion: number;
};

const roleLabel: Record<Role, string> = {
  student: "学生",
  teacher: "教师",
  parent: "家长",
  admin: "管理员",
};

export function AdminUserManager({
  users,
  canManagePasswords,
}: {
  users: AdminUserSummary[];
  canManagePasswords: boolean;
}) {
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const selectedUser = users.find((user) => user.id === selectedUserId);

  function submitPasswordReset() {
    if (!canManagePasswords) {
      setMessage("当前账号不是超级管理员，不能重置密码。");
      return;
    }
    if (!selectedUserId || password.length < 8) {
      setMessage("请选择账号，并输入不少于 8 位的新密码。");
      return;
    }

    startTransition(async () => {
      setMessage(null);
      const response = await fetch("/api/admin/users/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, password }),
      });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setMessage(payload.message ?? payload.error ?? "密码更新失败。");
        return;
      }
      setPassword("");
      setMessage(payload.message ?? "密码已更新。");
    });
  }

  return (
    <section className="panel rounded-[2rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="bz-eyebrow">SUPER ADMIN</p>
          <h2 className="mt-3 text-3xl font-black text-slate-950">账号与密码管理</h2>
          <p className="mt-2 max-w-2xl text-base font-semibold leading-8 text-slate-600">
            超级管理员可查看演示环境账号，并为学生、教师、家长或管理员重置密码。重置后旧会话会立即失效。
          </p>
        </div>
        <div
          className={cn(
            "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-black",
            canManagePasswords ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-500",
          )}
        >
          <ShieldCheck className="h-4 w-4" />
          {canManagePasswords ? "已启用超级权限" : "只读模式"}
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => setSelectedUserId(user.id)}
              className={cn(
                "min-h-[104px] rounded-[1.5rem] border p-4 text-left transition-all hover:-translate-y-0.5",
                selectedUserId === user.id
                  ? "border-orange-400 bg-orange-50 shadow-[0_18px_42px_rgba(240,138,56,0.14)]"
                  : "border-slate-200 bg-slate-50 hover:border-orange-300 hover:bg-white",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-black text-slate-950">{user.name}</p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-500">{user.email}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                  {roleLabel[user.role]}
                </span>
              </div>
              <p className="mt-3 line-clamp-1 text-sm font-semibold text-slate-500">{user.title}</p>
            </button>
          ))}
        </div>

        <div className="rounded-[1.7rem] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-orange-500" />
            <h3 className="text-2xl font-black text-slate-950">重置密码</h3>
          </div>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-500">
            当前选择：{selectedUser ? `${selectedUser.name} / ${selectedUser.email}` : "未选择账号"}
          </p>
          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-bold text-slate-600">新密码</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder="至少 8 位"
              disabled={!canManagePasswords}
              className="bz-field"
            />
          </label>
          <button
            type="button"
            onClick={submitPasswordReset}
            disabled={isPending || !canManagePasswords}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-slate-950 px-5 text-base font-black text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
          >
            {isPending ? "正在更新..." : "确认更新密码"}
          </button>
          {message ? (
            <p className="mt-4 rounded-2xl bg-orange-50 px-4 py-3 text-sm font-bold leading-6 text-orange-700">
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
