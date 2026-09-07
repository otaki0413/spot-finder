import { connection } from "next/server";
import { SpotFinder } from "@/features/spots/spot-finder";

export default async function Home() {
  await connection();

  return (
    <main className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          Spot Finder
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          地図を動かして、気になる場所の周辺スポットを見つけましょう。
        </p>
      </header>
      <SpotFinder
        apiKey={process.env.GOOGLE_MAPS_API_KEY?.trim() ?? ""}
        mapId={process.env.GOOGLE_MAPS_MAP_ID?.trim() || "DEMO_MAP_ID"}
      />
    </main>
  );
}
