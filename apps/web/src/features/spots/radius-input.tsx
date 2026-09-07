import { useState } from "react";
import { parseRadius } from "./nearby-spots";

export function RadiusInput({
  radiusKm,
  onApply,
}: {
  radiusKm: number;
  onApply: (radiusKm: number) => void;
}) {
  const [draft, setDraft] = useState(String(radiusKm));
  const [error, setError] = useState(false);

  function commit(value: string) {
    const radius = parseRadius(value);
    setError(radius === null);
    if (radius !== null) onApply(radius);
  }

  return (
    <div>
      <label htmlFor="radius" className="text-sm font-semibold text-slate-800">
        検索半径
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          id="radius"
          type="number"
          inputMode="decimal"
          step="any"
          value={draft}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={(event) => commit(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit(event.currentTarget.value);
            }
          }}
          aria-invalid={error}
          aria-describedby={error ? "radius-help radius-error" : "radius-help"}
          className="min-h-11 w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-offset-4 focus-visible:outline-2 focus-visible:outline-blue-600 aria-invalid:border-red-600"
        />
        <span className="text-sm text-slate-700">km</span>
      </div>
      <p id="radius-help" className="mt-2 text-xs leading-5 text-slate-600">
        Enterキー、または入力欄から離れると反映します。
      </p>
      {error && (
        <p id="radius-error" role="alert" className="mt-2 text-sm text-red-700">
          0より大きい有効な数値を入力してください。現在の半径は{radiusKm}
          kmです。
        </p>
      )}
    </div>
  );
}
