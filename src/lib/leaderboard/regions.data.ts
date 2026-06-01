/**
 * China administrative divisions (province + prefecture city) for the
 * region picker, keyed by GB/T 2260 codes (province = 2-digit, city = 4-digit).
 *
 * NOTE: this is a real but REPRESENTATIVE seed for development/testing. Before
 * launch, swap in the full GB/T 2260 dataset (~34 provinces / ~333 cities), e.g.
 * imported from the `china-division` package — `regions.ts` consumes this shape
 * unchanged.
 */
export interface CityData {
  code: string; // 4-digit, e.g. "5101"
  name: string;
}
export interface ProvinceData {
  code: string; // 2-digit, e.g. "51"
  name: string;
  cities: CityData[];
}

export const PROVINCES: readonly ProvinceData[] = [
  { code: "11", name: "北京市", cities: [{ code: "1101", name: "北京市" }] },
  { code: "12", name: "天津市", cities: [{ code: "1201", name: "天津市" }] },
  { code: "31", name: "上海市", cities: [{ code: "3101", name: "上海市" }] },
  { code: "50", name: "重庆市", cities: [{ code: "5001", name: "重庆市" }] },
  {
    code: "51",
    name: "四川省",
    cities: [
      { code: "5101", name: "成都市" },
      { code: "5103", name: "自贡市" },
      { code: "5106", name: "德阳市" },
      { code: "5107", name: "绵阳市" },
    ],
  },
  {
    code: "44",
    name: "广东省",
    cities: [
      { code: "4401", name: "广州市" },
      { code: "4403", name: "深圳市" },
      { code: "4406", name: "佛山市" },
      { code: "4419", name: "东莞市" },
    ],
  },
  {
    code: "33",
    name: "浙江省",
    cities: [
      { code: "3301", name: "杭州市" },
      { code: "3302", name: "宁波市" },
      { code: "3303", name: "温州市" },
    ],
  },
  {
    code: "32",
    name: "江苏省",
    cities: [
      { code: "3201", name: "南京市" },
      { code: "3202", name: "无锡市" },
      { code: "3205", name: "苏州市" },
    ],
  },
  {
    code: "37",
    name: "山东省",
    cities: [
      { code: "3701", name: "济南市" },
      { code: "3702", name: "青岛市" },
    ],
  },
  { code: "42", name: "湖北省", cities: [{ code: "4201", name: "武汉市" }] },
] as const;
