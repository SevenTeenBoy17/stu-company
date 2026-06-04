/**
 * Region access + validation over the GB/T 2260 dataset (regions.data.ts).
 * Used by the required region picker and by API-side validation of self-input
 * province/city (decision 2: school + region are mandatory and structured —
 * never free text).
 */
import { PROVINCES, type CityData } from "./regions.data";

const provinceByCode = new Map(PROVINCES.map((p) => [p.code, p]));
const cityToProvince = new Map<string, string>();
for (const p of PROVINCES) {
  for (const c of p.cities) cityToProvince.set(c.code, p.code);
}

export function provinces(): { code: string; name: string }[] {
  return PROVINCES.map((p) => ({ code: p.code, name: p.name }));
}

export function citiesOf(provinceCode: string): CityData[] {
  return provinceByCode.get(provinceCode)?.cities.map((c) => ({ ...c })) ?? [];
}

export function isValidProvince(code: string): boolean {
  return provinceByCode.has(code);
}

/** True only when the city exists AND belongs to the given province. */
export function isValidCity(provinceCode: string, cityCode: string): boolean {
  const province = provinceByCode.get(provinceCode);
  return Boolean(province) && province!.cities.some((c) => c.code === cityCode);
}

export function provinceOfCity(cityCode: string): string | undefined {
  return cityToProvince.get(cityCode);
}

export function regionLabel(provinceCode: string, cityCode?: string): string {
  const province = provinceByCode.get(provinceCode);
  const city = cityCode ? province?.cities.find((c) => c.code === cityCode) : undefined;
  return [province?.name, city?.name].filter(Boolean).join(" · ");
}
