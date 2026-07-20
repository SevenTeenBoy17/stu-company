-- Migration 0022: student_parent_links.student_user_id UNIQUE (预合并审查 #1/#3)
-- Created: 2026-07-19
-- Context: 一名学生恒定只绑定一位家长——growth_reports 对 student_user_id 有唯一索引，
--          整套家长报告/周报模型都假设 1 学生 ↔ 1 家长。本 PR 新增的
--          getOrCreateGuardianInviteForStudent（学生生成家长绑定码）此前只把
--          parentUserId==studentUserId 的占位链接当作可复用，且 student_user_id 只有【非唯一】索引：
--          ①并发两次 POST /api/student/parent-invite 各自 check-then-insert → 生成两条占位 link+两个有效码；
--          ②家长A 认领后占位标记消失，学生再铸一码给家长B → 1 学生被绑给 N 家长，且家长B 注册时
--            onConflictDoUpdate 静默把该学生唯一的成长报告 parentUserId 翻给 B，家长A 面板/周报被永久锁死。
--          UNIQUE 是这 1:1 模型的数据库地板：并发插入只留一行（复用同码=幂等），第二位家长无法建第二条 link。
-- NOTE: 若此迁移以 unique_violation 失败，说明库中已存在“一个学生多条 link”的脏数据，需先人工去重
--       （保留最早/已认领的一条），再重跑。故意不自动 DELETE：宁可失败告警，也不静默删除亲子绑定关系。
DROP INDEX IF EXISTS "student_parent_links_student_user_id_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "student_parent_links_student_user_id_key" ON "student_parent_links" ("student_user_id");
