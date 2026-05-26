import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { TeacherConsole } from "@/components/teacher/teacher-console";
import { getCurrentUser } from "@/lib/session-user";
import { getTeacherOverview, roleHomePath } from "@/lib/db/repo";

// UI-DEBT: Dedicated loading/empty/error states are still pending; see docs/ui-spec/audit-2026-05-25.md.
export default async function TeacherPage() {
  // L3: redirect rather than render a 200 AccessGate for unauthorised roles.
  const user = await getCurrentUser();
  if (!user) redirect("/demo?reason=login_required");
  if (user.role !== "teacher") redirect(roleHomePath(user.role));

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
