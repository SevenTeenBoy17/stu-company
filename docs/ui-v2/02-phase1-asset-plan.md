# UI v2 · Phase 1 素材生产清单（待用户确认后生产）

> 管线：gpt-image-2（`gpt-agent.cc/v1/images/generations`，b64_json）→ sharp 压 WebP → `public/brand/v2/`。
> 目标体积：hero < 100KB，卡片/徽章 < 40KB。风格双轨：**3D 萌宠延续**（与 `public/brand/pet-avatars/` 同风）+ **写实渲染质感**（hero 氛围）。
> 每张 prompt 共用风格锁前缀，保证整批光照/色板统一（琥珀主色 #f08a38 系、柔和晨光、干净留白）。

## 风格锁前缀（每条 prompt 前置）

**3D 萌宠系**：
`Cute 3D rendered mascot in soft clay/Pixar style, warm amber (#f08a38) accent palette, soft studio lighting, clean pastel background with generous negative space, consistent with a friendly brown bear financial-education brand for kids, no text, no watermark`

**写实质感系**：
`Photorealistic cinematic render, warm morning light, amber-gold accents, shallow depth of field, premium fintech-editorial mood, clean composition with clear negative space for headline text, no text, no watermark`

## 清单（共 21 张）

| # | 用途 / 页面 | 文件名（public/brand/v2/） | 风格 | 尺寸 | Prompt 主体（前缀之后） |
| --- | --- | --- | --- | --- | --- |
| 1 | `/` hero 主视觉 | `hero-classroom-market.webp` | 写实+萌宠混搭 | 1536×1024 | A cozy sunlit classroom desk with a miniature holographic city financial district rising from an open textbook, a cute 3D brown bear mascot in a tiny suit standing beside it pointing with a teacher's baton, amber holographic charts floating |
| 2 | `/` 三幕叙事 · 学 | `story-learn.webp` | 3D 萌宠 | 1024×1024 | The brown bear mascot reading a glowing oversized book, floating icons of coins-plant-shield around, curious expression |
| 3 | `/` 三幕叙事 · 练 | `story-practice.webp` | 3D 萌宠 | 1024×1024 | The brown bear mascot at a tiny trading desk with three candy-colored monitors showing simple rising charts, focused expression |
| 4 | `/` 三幕叙事 · 看见成长 | `story-growth.webp` | 3D 萌宠 | 1024×1024 | The brown bear mascot standing on a podium of stacked coins shaped like a staircase, holding a small trophy, proud expression, confetti |
| 5-12 | `/learn` 8 模块徽章 | `learn-{module}.webp` ×8 | 3D 萌宠道具 | 1024×1024 | 每模块一件标志道具（复利=发芽的金币盆栽 / 风险=盾牌与骰子 / 配置=天平上的三色资产块 / 现金流=水车与硬币流 / 信用=钥匙与徽章 / 保险=雨伞下的存钱罐 / 定投=日历与滴灌壶 / 市场=望远镜与山峰折线），同一浅色圆形舞台 |
| 13 | `/demo` 学生入口 | `role-student.webp` | 3D 萌宠 | 1024×1024 | The brown bear mascot wearing a school backpack waving hello in front of a pastel dashboard |
| 14 | `/demo` 教师入口 | `role-teacher.webp` | 3D 萌宠 | 1024×1024 | The bear mascot with glasses and a pointer beside a small blackboard with a simple rising chart |
| 15 | `/demo` 家长入口 | `role-parent.webp` | 3D 萌宠 | 1024×1024 | A larger gentle bear with a smaller bear cub looking together at a warm glowing weekly report card |
| 16 | `/demo` 管理员入口 | `role-admin.webp` | 3D 萌宠 | 1024×1024 | The bear mascot with a headset at a mission-control desk with tidy status lights, calm and organized |
| 17 | `/pricing` 免费试用 | `plan-trial.webp` | 3D 萌宠 | 1024×1024 | The bear mascot holding a small sprout in a pot, hopeful, minimal props |
| 18 | `/pricing` 标准版 | `plan-standard.webp` | 3D 萌宠 | 1024×1024 | The bear mascot with a neat toolbox of glowing financial tools, confident |
| 19 | `/pricing` 学校授权 | `plan-school.webp` | 3D 萌宠 | 1024×1024 | Three bear mascots as a tiny classroom team with a banner, collaborative and warm |
| 20 | 深色行情带背景 | `texture-market-dark.webp` | 写实质感 | 1536×640 | Abstract dark navy financial texture with faint amber candlestick glow lines, subtle depth, very low contrast suitable as background behind white text |
| 21 | 浅色板块底纹 | `texture-paper-light.webp` | 写实质感 | 1536×640 | Ultra-subtle warm off-white paper texture with faint amber geometric grid, nearly invisible, background use |

## 使用规则

- 全部走 sharp 压缩（质量 78–82），落 `public/brand/v2/`（不进 src，避开 Tailwind content-scan）。
- `<Image>` 组件 + 明确 width/height，防 CLS；hero 加 `priority`。
- 图片是**信息替代**，不是装饰堆叠：每张图对应审计清单里一个「图形化」或被折叠板块释放出的视觉空间。
- alt 文案中文、描述性（a11y 承诺）。

## 待确认项

1. 21 张清单是否有增删（如 /pricing 三张是否需要）；
2. hero 主视觉走「教室×全息沙盘」概念还是更抽象的「琥珀金融山谷」；
3. 生成密钥沿用之前 gpt-image-2 管线的 env 配置（不入库）。
