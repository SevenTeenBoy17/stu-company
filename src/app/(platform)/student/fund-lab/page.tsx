import { redirect } from "next/navigation";

import { PlatformLayout } from "@/components/platform/platform-layout";
import { StudentFundLabDashboard } from "@/components/student/student-fund-lab-dashboard";
import { getSimulationStateForUser, roleHomePath } from "@/lib/db/repo";
import { buildFundLabPayload } from "@/lib/fund-lab";
import { getCurrentUser } from "@/lib/session-user";

export const metadata = {
  title: "基金/ETF实验室 - Brown Zone",
  description: "用模拟组合理解指数、债券、黄金和主题基金的风险、回撤与分散配置。",
};

export default async function StudentFundLabPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/demo?reason=login_required");
  if (user.role !== "student") redirect(roleHomePath(user.role));

  const state = await getSimulationStateForUser(user.id);

  return (
    <PlatformLayout
      role="student"
      heading="学生策略台"
      summary="把基金/ETF当作课堂组合实验，而不是真实产品推荐：比较分散度、回撤和长期纪律。"
    >
      <StudentFundLabDashboard initialPayload={buildFundLabPayload(state.run)} />
    </PlatformLayout>
  );
}
