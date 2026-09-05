import { connection } from "next/server";

async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(
      new URL("/health", process.env.API_URL ?? "http://api:3001"),
      { cache: "no-store", signal: AbortSignal.timeout(3000) },
    );

    if (response.status !== 200) return false;

    const health: unknown = await response.json();
    return (
      typeof health === "object" &&
      health !== null &&
      "status" in health &&
      health.status === "ok" &&
      "database" in health &&
      health.database === "ok"
    );
  } catch {
    return false;
  }
}

export default async function Home() {
  await connection();
  const healthy = await checkHealth();

  return (
    <main className="flex min-h-svh items-center justify-center px-4 py-12 sm:px-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Spot Finder
        </h1>
        <p className="mt-2 text-sm text-slate-600">開発環境の接続確認</p>

        <div
          className={`mt-8 rounded-xl border p-4 ${
            healthy
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <h2 className="font-semibold leading-7">
            {healthy ? "API・DBに接続できました" : "接続を確認できませんでした"}
          </h2>
          <p className="mt-1 text-sm leading-6">
            {healthy
              ? "再確認すると最新の接続状態を取得します。"
              : "APIとDBの起動状態を確認して、もう一度お試しください。"}
          </p>
        </div>

        {/* eslint-disable-next-line nextjs/no-html-link-for-pages -- ページ全体を再読み込みし、接続状態を再取得する。 */}
        <a
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
        >
          再確認する
        </a>
      </div>
    </main>
  );
}
