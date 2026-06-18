"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <main style={{ minHeight: "100vh", background: "#f1f5f9", padding: "40px 20px", color: "#020617" }}>
          <section style={{ margin: "0 auto", display: "flex", minHeight: "70vh", maxWidth: 768, alignItems: "center" }}>
            <div
              style={{
                width: "100%",
                borderRadius: 32,
                border: "1px solid #e2e8f0",
                background: "#fff",
                padding: 32,
                boxShadow: "0 24px 80px rgba(15,23,42,0.12)",
              }}
            >
              <p style={{ color: "#d97706", fontSize: 14, fontWeight: 700, letterSpacing: "0.24em" }}>RECOVERY</p>
              <h1 style={{ marginTop: 12, fontSize: 32, fontWeight: 800 }}>页面加载出错了</h1>
              <p style={{ marginTop: 12, color: "#475569", fontSize: 16, lineHeight: 1.8 }}>
                系统已拦截异常，没有显示英文白屏。可以先重试；如果仍然失败，请返回首页或联系管理员检查服务状态。
              </p>
              {error?.digest ? (
                <p style={{ marginTop: 16, borderRadius: 20, background: "#f8fafc", padding: 16, color: "#64748b" }}>
                  诊断编号：{error.digest}。如果多次重试仍失败，请把这个编号交给管理员。
                </p>
              ) : (
                <p style={{ marginTop: 16, borderRadius: 20, background: "#f8fafc", padding: 16, color: "#64748b" }}>
                  诊断提示：请检查数据库、登录状态或本地服务是否正在运行。
                </p>
              )}
              <button
                type="button"
                onClick={reset}
                style={{
                  marginTop: 24,
                  height: 48,
                  borderRadius: 999,
                  border: 0,
                  background: "#020617",
                  padding: "0 24px",
                  color: "#fff",
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                重试
              </button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
