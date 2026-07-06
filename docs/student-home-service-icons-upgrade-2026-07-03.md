# 学生首页服务九宫格图标替换说明

更新时间：2026-07-03  
范围：学生端首页服务台的「服务九宫格」

## 背景

原「服务九宫格」复用了 `public/brand/quest-world/characters/` 下的 3D 动物角色头像，与任务中心的任务世界视觉体系重复，容易让学生误以为两个区域属于同一类任务卡片。

本次改造将服务入口图标替换为「工具 / 场景」类原创图形，让它更像学习服务台、理财工具箱和生活决策入口，而不是任务中心角色卡。

## 新图标资产

新资产目录：

- `public/brand/service-icons/service-icons-sheet.png`
- `public/brand/service-icons/market-radar.webp`
- `public/brand/service-icons/opportunity-map.webp`
- `public/brand/service-icons/wealth-chest.webp`
- `public/brand/service-icons/fund-basket.webp`
- `public/brand/service-icons/auto-invest-bot.webp`
- `public/brand/service-icons/life-ledger.webp`
- `public/brand/service-icons/goal-piggy.webp`
- `public/brand/service-icons/protection-umbrella.webp`
- `public/brand/service-icons/credit-lab-scale.webp`
- `public/brand/service-icons/risk-gauge.webp`
- `public/brand/service-icons/quest-checklist.webp`
- `public/brand/service-icons/history-scroll.webp`
- `public/brand/service-icons/service-icons-preview.jpg`

## 视觉方向

- 风格：卡通 3D / clay render / 圆润工具图标
- 情绪：青少年友好、轻松、有趣、带一点真实理财工具感
- 色彩：暖琥珀、奶油白、薄荷绿、天空蓝、深海军蓝点缀
- 约束：不使用动物角色、不出现文字/水印/Logo、不复用任务中心图案

## 生成提示词摘要

使用内置 `image_gen` 生成 4 x 3 图标表，主题按服务入口顺序排列：

1. 市场雷达：雷达望远镜 + K 线火花
2. 机会训练场：藏宝地图 + 放大镜
3. 我的财富：财富箱 + 金币
4. 基金/ETF 实验室：基金篮 + 饼图
5. 定投机器人：机械臂 + 日历金币
6. 生活账本：记账本 + 计算器
7. 目标账户：存钱罐 + 小旗帜
8. 风险保护伞：雨伞 + 盾牌
9. 信用实验室：信用卡 + 天平
10. 风险测评：风险仪表盘
11. 任务中心：清单夹 + 星章
12. 历史复盘：卷轴 + 回放箭头

## 代码改动

组件：`src/components/student/student-home-hub.tsx`

- 将 `serviceCharacter` 替换为 `serviceIcon`
- 图片路径从 `/brand/quest-world/characters/*.webp` 改为 `/brand/service-icons/*.webp`
- 保留原有卡片结构、标题、关键词、ARIA 描述、状态徽标和跳转逻辑

## 验收标准

- 服务九宫格不再引用 `quest-world/characters` 角色头像
- 12 个服务入口均能找到对应 WebP 资产
- 图标与任务中心视觉不重复
- `npm run lint` 通过
- `npx tsc --noEmit` 通过
- `npm run build` 通过

