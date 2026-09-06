import * as v from "valibot";

const queryNumber = v.pipe(
  v.string(),
  v.trim(),
  v.nonEmpty(),
  v.transform(Number),
  v.number(),
  v.finite(),
);

export const nearbySpotsQuerySchema = v.strictObject({
  latitude: v.pipe(queryNumber, v.minValue(-90), v.maxValue(90)),
  longitude: v.pipe(queryNumber, v.minValue(-180), v.maxValue(180)),
  radiusKm: v.pipe(
    queryNumber,
    v.gtValue(0),
    v.check(
      (value) => Number.isFinite(value * 1000),
      "Radius in meters must be finite",
    ),
  ),
});

export type NearbySpotsQuery = v.InferOutput<typeof nearbySpotsQuerySchema>;
