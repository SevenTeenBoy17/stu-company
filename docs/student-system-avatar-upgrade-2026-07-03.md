# 学生主页系统分配 3D 个人形象升级说明

## 目标

学生登录后的主页 PET STUDIO 区域需要使用 3D 卡通个人形象，并且形象来自系统图库自动分配，而不是由学生手动选择或随机切换。

本次升级完成了三件事：

- 新增 25 张原创 3D 卡通学习伙伴头像。
- 移除学生端的“切换形象 / 随机 / 选择伙伴形象”入口。
- 按学生 `pet.id` 稳定分配头像，保证同一账号每次看到的形象一致。

## 视觉资产

资产目录：

- `public/brand/student-avatars/student-avatar-sheet.png`
- `public/brand/student-avatars/student-avatar-preview.jpg`
- `public/brand/student-avatars/avatar-01.webp` 至 `avatar-25.webp`

生成方式：

- 使用内置 `imagegen` 生图能力生成一张 5x5 母版。
- 使用本地 Pillow 裁切为 25 张 `512x512` WebP。
- 图形主题包含机器人、云朵、书本、盾牌、指南针、计算器、望远镜、储蓄罐、火箭等学习伙伴，避免继续复用任务中心动物角色头像。

## 实现说明

主要代码：

- `src/components/student/student-pet-reward-studio.tsx`

关键逻辑：

- `AVATAR_GALLERY` 固定映射 25 张头像资源。
- `stableAvatarIndex(seed)` 使用 FNV-1a 风格哈希，不依赖 `Math.random()`。
- `assignedAvatarForPet(payload.pet.id)` 返回系统分配头像。
- 组件不再读取或写入 `brown-zone-pet-avatar-*` 的 `localStorage`。
- 组件不再渲染头像选择弹窗，也不再提供“随机”按钮。

前端展示：

- PET STUDIO 左侧头像卡展示系统分配的 3D 头像。
- 头像下方显示“系统分配形象：<名称>”。
- 说明文案明确“从 25 位 3D 学习伙伴中按账号自动分配，不提供手动切换。”

## 同类问题检查

检查范围：

- `src/components/student`
- `src/app/(platform)`
- `src/app/api/student`

关键词：

- `形象`
- `头像`
- `avatar`
- `pet-avatars`
- `student-avatars`
- `切换`
- `随机`

结果：

- 学生 PET STUDIO 已没有“切换形象 / 随机换一位伙伴形象 / 选择伙伴形象”残留。
- 服务九宫格继续使用工具/场景图标，不复用任务中心角色头像。
- 任务中心保留的“切换今日航线”属于任务筛选，不属于个人形象切换。
- 任务中心角色图仍用于任务卡收藏语境，不影响学生主页个人形象。

## 响应式验证

已检查视口：

- 桌面：`1440x1100`
- 平板：`768x1024`
- 手机：`390x844`

截图证据：

- `.tmp/student-avatar-check/desktop.png`
- `.tmp/student-avatar-check/tablet.png`
- `.tmp/student-avatar-check/mobile.png`
- `.tmp/student-avatar-check/pet-panel.png`
- `.tmp/student-avatar-check/mobile-panel.png`

自动探针结果：

- `/student` 可登录进入。
- 新头像实际加载路径包含 `/brand/student-avatars/avatar-24.webp`。
- 旧按钮文案数量为 `0`。
- 三档视口 `horizontalOverflow = 0`。
- 控制台错误数量为 `0`。
- 三档视口均检测到“系统分配形象 / 不提供手动切换”说明文案。

## 验证命令

已运行：

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

补充运行：

```powershell
node <Playwright 三档视口验收脚本>
python -m code_review_graph update --base HEAD --skip-flows
python -m code_review_graph detect-changes --base HEAD --brief
```

验证结论：

- `npx tsc --noEmit`：通过。
- `npm run lint`：通过。
- `npm run build`：通过，61 个页面生成成功。
- Playwright 三档视口验收：通过。
- `code_review_graph`：风险分 `0.00`，未发现受影响流程和测试缺口。
