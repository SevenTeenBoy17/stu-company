import { PlatformLayout } from "@/components/platform/platform-layout";
import { AccessGate } from "@/components/shared/access-gate";
import { TeacherConsole } from "@/components/teacher/teacher-console";
import { getCurrentUser } from "@/lib/session-user";
import { getTeacherOverview } from "@/lib/db/repo";

// UI-DEBT: Dedicated loading/empty/error states are still pending; see docs/ui-spec/audit-2026-05-25.md.
export default async function TeacherPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "teacher") {
    return (
      <div className="page-shell py-10">
        <AccessGate
          title="教师指挥舱需要教师账号登录"
          description="请先从试玩入口使用教师样例账号登录，或用教师邀请码注册。登录后这里会展示班级榜单、任务管理、学生行为标签和邀请码池。"
        />
      </div>
    );
  }

  const overview = await getTeacherOverview(user.id);

  return (
    <PlatformLayout
      role="teacher"
      heading="教师指挥舱"
      summary="围绕一位老师的试点班级展开：任务发布、排行榜、邀请码池与学生行为标签全部汇总在一个教学控制面板。"
    >
      <TeacherConsole initialData={overview} />
    </PlatformLayout>
  );
}
