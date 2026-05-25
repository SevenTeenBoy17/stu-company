import { PlatformLayout } from "@/components/platform/platform-layout";
import { AccessGate } from "@/components/shared/access-gate";
import { StudentSandbox } from "@/components/student/student-sandbox";
import { getCurrentUser } from "@/lib/session-user";
import { getSimulationStateForUser } from "@/lib/store";

export default async function StudentPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "student") {
    return (
      <div className="page-shell py-10">
        <AccessGate
          title="学生策略台需要学生账号登录"
          description="请先从试玩入口使用学生样例账号登录，或使用学生邀请码注册后进入。登录后这里会展示 12 回合经济沙盘、统一交易面板和 AI 导师点评。"
        />
      </div>
    );
  }

  const initialState = getSimulationStateForUser(user.id);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="围绕一名学生的一整学期沙盘体验展开：下单、储蓄、房产、创业、回合推进与 AI 导师复盘。"
    >
      <StudentSandbox initialState={initialState} />
    </PlatformLayout>
  );
}
