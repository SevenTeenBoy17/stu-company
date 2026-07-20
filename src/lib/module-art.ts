/**
 * UI v2：8 大课程模块 → gpt-image-2 生成的 3D 概念道具图（public/brand/v2/learn-*.webp）。
 * 与 pet-avatars 同风格（软陶 3D、琥珀点缀、浅色圆形舞台）。图为概念道具而非字面图标，
 * 语义由 alt 承载。落地页与 /learn 课程卡共用，保证同一模块两处视觉一致。
 */
export const moduleArt: Record<string, { src: string; alt: string }> = {
  equities: {
    src: "/brand/v2/learn-market.webp",
    alt: "黄铜望远镜对准一座折线上升形状的山峰——观察市场趋势",
  },
  portfolio: {
    src: "/brand/v2/learn-allocation.webp",
    alt: "天平托着金、蓝、绿三色资产块——资产配置的平衡",
  },
  banking: {
    src: "/brand/v2/learn-compound.webp",
    alt: "盆栽长出金币叶子——储蓄与复利的生长",
  },
  property: {
    src: "/brand/v2/learn-cashflow.webp",
    alt: "小水车带动金币溪流——房产租金与现金流循环",
  },
  venture: {
    src: "/brand/v2/learn-risk.webp",
    alt: "盾牌倚着两枚骰子——创业中的风险与保护",
  },
  events: {
    src: "/brand/v2/learn-insurance.webp",
    alt: "琥珀色小伞护着存钱罐——为突发事件做好保护",
  },
  competition: {
    src: "/brand/v2/learn-credit.webp",
    alt: "金钥匙与荣誉徽章——联赛成就与信用积累",
  },
  guardian: {
    src: "/brand/v2/learn-autoinvest.webp",
    alt: "台历旁的小水壶浇灌金币幼苗——家校陪伴下的定期成长",
  },
};
