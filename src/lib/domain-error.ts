/**
 * 领域校验错误（业务规则拒绝，如"本回合已提交""余额不足""名额已满""邀请码已过期"）。
 *
 * 与【基础设施/数据完整性错误】(DB 连接失败、查询超时、JSONB 损坏、写入回读落空)在语义上是两回事：
 * 后者代表系统故障、应触发 `[repo.fallback]` SLI 告警；前者是用户可预期的正常拒绝，不该告警。
 *
 * `src/lib/db/repo.ts` 的 withDbExecutor catch 用 `err instanceof DomainError` 把领域错误直接冒泡
 * （不 logFallback、不发 SLI、不计入 fallbackCount、不走内存兜底），从而消除写/读事务里领域拒绝
 * 造成的【虚假 DB 故障告警】（itest6 R3 P3-5）。
 *
 * 关键：领域拒绝不仅在 repo.ts 里抛出，也在被 repo 事务调用的纯教学模块
 * （simulation / life-cashflow / quests / auto-invest / credit-lab / goal-accounts / opportunity /
 * wealth-review / season-challenges …）里抛出。因此 DomainError 必须放在这个【零依赖】模块，
 * 供两侧共同 import 而不产生循环依赖。
 *
 * 它仍是 Error 子类、message 原样不变，路由 handleRouteError 依旧按 `instanceof Error ? message`
 * + 消息内容映射 `{error,message}`+状态码，用户中文提示与状态码保持一致。
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}
