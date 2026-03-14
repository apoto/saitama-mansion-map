import type { StationData } from "@/lib/types";

function generateYearData(basePrice: number, baseCount: number) {
  const years: StationData["years"] = {};
  for (let y = 2020; y <= 2025; y++) {
    const drift = 1 + (y - 2020) * 0.03 + (Math.random() - 0.5) * 0.04;
    const price = Math.round(basePrice * drift);
    const count = Math.max(1, Math.round(baseCount * (0.8 + Math.random() * 0.4)));
    years[String(y)] = {
      all: { count, avgPrice70: price, medianPrice70: Math.round(price * 0.97) },
      age_0_10: {
        count: Math.max(0, Math.round(count * 0.25)),
        avgPrice70: Math.round(price * 1.25),
        medianPrice70: Math.round(price * 1.22),
      },
      age_11_20: {
        count: Math.max(0, Math.round(count * 0.3)),
        avgPrice70: Math.round(price * 1.05),
        medianPrice70: Math.round(price * 1.02),
      },
      age_21_30: {
        count: Math.max(0, Math.round(count * 0.25)),
        avgPrice70: Math.round(price * 0.85),
        medianPrice70: Math.round(price * 0.83),
      },
      age_31_plus: {
        count: Math.max(0, Math.round(count * 0.2)),
        avgPrice70: Math.round(price * 0.65),
        medianPrice70: Math.round(price * 0.63),
      },
    };
  }
  return years;
}

export const stationData: StationData[] = [
  // さいたま市
  { stationCode: "S001", stationName: "大宮", lat: 35.9062, lng: 139.6237, lines: ["JR京浜東北線", "JR宇都宮線", "東武野田線"], area: "さいたま市", years: generateYearData(4200, 65) },
  { stationCode: "S002", stationName: "浦和", lat: 35.8585, lng: 139.6566, lines: ["JR京浜東北線", "JR宇都宮線"], area: "さいたま市", years: generateYearData(4800, 55) },
  { stationCode: "S003", stationName: "北浦和", lat: 35.8724, lng: 139.6495, lines: ["JR京浜東北線"], area: "さいたま市", years: generateYearData(3800, 35) },
  { stationCode: "S004", stationName: "南浦和", lat: 35.8440, lng: 139.6712, lines: ["JR京浜東北線", "JR武蔵野線"], area: "さいたま市", years: generateYearData(3600, 40) },
  { stationCode: "S005", stationName: "武蔵浦和", lat: 35.8439, lng: 139.6376, lines: ["JR埼京線", "JR武蔵野線"], area: "さいたま市", years: generateYearData(4100, 50) },
  { stationCode: "S006", stationName: "さいたま新都心", lat: 35.8933, lng: 139.6350, lines: ["JR京浜東北線", "JR宇都宮線"], area: "さいたま市", years: generateYearData(4500, 30) },
  { stationCode: "S007", stationName: "与野", lat: 35.8820, lng: 139.6340, lines: ["JR京浜東北線"], area: "さいたま市", years: generateYearData(3500, 20) },
  { stationCode: "S008", stationName: "北与野", lat: 35.8880, lng: 139.6180, lines: ["JR埼京線"], area: "さいたま市", years: generateYearData(3400, 18) },
  { stationCode: "S009", stationName: "中浦和", lat: 35.8504, lng: 139.6245, lines: ["JR埼京線"], area: "さいたま市", years: generateYearData(3300, 15) },
  { stationCode: "S010", stationName: "岩槻", lat: 35.9500, lng: 139.6940, lines: ["東武野田線"], area: "さいたま市", years: generateYearData(2200, 18) },
  { stationCode: "S011", stationName: "東大宮", lat: 35.9350, lng: 139.6550, lines: ["JR宇都宮線"], area: "さいたま市", years: generateYearData(2600, 22) },
  { stationCode: "S012", stationName: "土呂", lat: 35.9220, lng: 139.6310, lines: ["JR宇都宮線"], area: "さいたま市", years: generateYearData(2800, 12) },

  // 川口・蕨・戸田
  { stationCode: "S020", stationName: "川口", lat: 35.8070, lng: 139.7210, lines: ["JR京浜東北線"], area: "川口・蕨・戸田", years: generateYearData(3800, 70) },
  { stationCode: "S021", stationName: "西川口", lat: 35.8170, lng: 139.7120, lines: ["JR京浜東北線"], area: "川口・蕨・戸田", years: generateYearData(3200, 45) },
  { stationCode: "S022", stationName: "蕨", lat: 35.8262, lng: 139.6950, lines: ["JR京浜東北線"], area: "川口・蕨・戸田", years: generateYearData(3100, 35) },
  { stationCode: "S023", stationName: "戸田公園", lat: 35.8145, lng: 139.6670, lines: ["JR埼京線"], area: "川口・蕨・戸田", years: generateYearData(3500, 30) },
  { stationCode: "S024", stationName: "戸田", lat: 35.8090, lng: 139.6780, lines: ["JR埼京線"], area: "川口・蕨・戸田", years: generateYearData(3300, 25) },
  { stationCode: "S025", stationName: "川口元郷", lat: 35.8120, lng: 139.7310, lines: ["埼玉高速鉄道"], area: "川口・蕨・戸田", years: generateYearData(3400, 20) },
  { stationCode: "S026", stationName: "鳩ヶ谷", lat: 35.8310, lng: 139.7420, lines: ["埼玉高速鉄道"], area: "川口・蕨・戸田", years: generateYearData(2800, 15) },

  // 越谷・草加・三郷
  { stationCode: "S030", stationName: "越谷レイクタウン", lat: 35.8740, lng: 139.8250, lines: ["JR武蔵野線"], area: "越谷・草加・三郷", years: generateYearData(3200, 40) },
  { stationCode: "S031", stationName: "南越谷", lat: 35.8680, lng: 139.7970, lines: ["JR武蔵野線", "東武伊勢崎線"], area: "越谷・草加・三郷", years: generateYearData(3000, 35) },
  { stationCode: "S032", stationName: "草加", lat: 35.8260, lng: 139.8050, lines: ["東武伊勢崎線"], area: "越谷・草加・三郷", years: generateYearData(2800, 30) },
  { stationCode: "S033", stationName: "越谷", lat: 35.8910, lng: 139.7910, lines: ["東武伊勢崎線"], area: "越谷・草加・三郷", years: generateYearData(2600, 25) },
  { stationCode: "S034", stationName: "三郷", lat: 35.8340, lng: 139.8630, lines: ["JR武蔵野線"], area: "越谷・草加・三郷", years: generateYearData(2400, 18) },
  { stationCode: "S035", stationName: "八潮", lat: 35.8230, lng: 139.8390, lines: ["つくばエクスプレス"], area: "越谷・草加・三郷", years: generateYearData(3100, 22) },

  // 春日部・久喜
  { stationCode: "S040", stationName: "春日部", lat: 35.9750, lng: 139.7520, lines: ["東武伊勢崎線", "東武野田線"], area: "春日部・久喜", years: generateYearData(2000, 25) },
  { stationCode: "S041", stationName: "久喜", lat: 36.0620, lng: 139.6660, lines: ["JR宇都宮線", "東武伊勢崎線"], area: "春日部・久喜", years: generateYearData(1800, 18) },
  { stationCode: "S042", stationName: "蓮田", lat: 35.9940, lng: 139.6580, lines: ["JR宇都宮線"], area: "春日部・久喜", years: generateYearData(1600, 12) },
  { stationCode: "S043", stationName: "白岡", lat: 36.0180, lng: 139.6690, lines: ["JR宇都宮線"], area: "春日部・久喜", years: generateYearData(1400, 8) },

  // 所沢・入間・狭山
  { stationCode: "S050", stationName: "所沢", lat: 35.7870, lng: 139.4690, lines: ["西武池袋線", "西武新宿線"], area: "所沢・入間・狭山", years: generateYearData(3200, 45) },
  { stationCode: "S051", stationName: "入間市", lat: 35.8360, lng: 139.3910, lines: ["西武池袋線"], area: "所沢・入間・狭山", years: generateYearData(2000, 18) },
  { stationCode: "S052", stationName: "狭山市", lat: 35.8530, lng: 139.4120, lines: ["西武新宿線"], area: "所沢・入間・狭山", years: generateYearData(1800, 15) },
  { stationCode: "S053", stationName: "小手指", lat: 35.7920, lng: 139.4340, lines: ["西武池袋線"], area: "所沢・入間・狭山", years: generateYearData(2400, 20) },
  { stationCode: "S054", stationName: "飯能", lat: 35.8560, lng: 139.3270, lines: ["西武池袋線"], area: "所沢・入間・狭山", years: generateYearData(1500, 10) },

  // 川越・ふじみ野
  { stationCode: "S060", stationName: "川越", lat: 35.9080, lng: 139.4850, lines: ["JR川越線", "東武東上線"], area: "川越・ふじみ野", years: generateYearData(2800, 35) },
  { stationCode: "S061", stationName: "本川越", lat: 35.9120, lng: 139.4860, lines: ["西武新宿線"], area: "川越・ふじみ野", years: generateYearData(2600, 15) },
  { stationCode: "S062", stationName: "ふじみ野", lat: 35.8640, lng: 139.5190, lines: ["東武東上線"], area: "川越・ふじみ野", years: generateYearData(3100, 30) },
  { stationCode: "S063", stationName: "上福岡", lat: 35.8570, lng: 139.5260, lines: ["東武東上線"], area: "川越・ふじみ野", years: generateYearData(2700, 20) },
  { stationCode: "S064", stationName: "志木", lat: 35.8380, lng: 139.5800, lines: ["東武東上線"], area: "川越・ふじみ野", years: generateYearData(3500, 32) },
  { stationCode: "S065", stationName: "鶴瀬", lat: 35.8490, lng: 139.5370, lines: ["東武東上線"], area: "川越・ふじみ野", years: generateYearData(2500, 18) },

  // 朝霞・新座・和光
  { stationCode: "S070", stationName: "朝霞", lat: 35.8140, lng: 139.5930, lines: ["東武東上線"], area: "朝霞・新座・和光", years: generateYearData(3600, 28) },
  { stationCode: "S071", stationName: "朝霞台", lat: 35.8210, lng: 139.6060, lines: ["東武東上線", "JR武蔵野線"], area: "朝霞・新座・和光", years: generateYearData(3400, 35) },
  { stationCode: "S072", stationName: "和光市", lat: 35.7920, lng: 139.6120, lines: ["東武東上線", "東京メトロ有楽町線"], area: "朝霞・新座・和光", years: generateYearData(3800, 30) },
  { stationCode: "S073", stationName: "新座", lat: 35.7940, lng: 139.5610, lines: ["JR武蔵野線"], area: "朝霞・新座・和光", years: generateYearData(2800, 20) },

  // 上尾・桶川・北本
  { stationCode: "S080", stationName: "上尾", lat: 35.9530, lng: 139.5880, lines: ["JR高崎線"], area: "上尾・桶川・北本", years: generateYearData(2400, 25) },
  { stationCode: "S081", stationName: "桶川", lat: 35.9930, lng: 139.5560, lines: ["JR高崎線"], area: "上尾・桶川・北本", years: generateYearData(2000, 18) },
  { stationCode: "S082", stationName: "北本", lat: 36.0270, lng: 139.5280, lines: ["JR高崎線"], area: "上尾・桶川・北本", years: generateYearData(1600, 12) },
  { stationCode: "S083", stationName: "鴻巣", lat: 36.0650, lng: 139.5100, lines: ["JR高崎線"], area: "上尾・桶川・北本", years: generateYearData(1400, 10) },

  // 熊谷・深谷・本庄
  { stationCode: "S090", stationName: "熊谷", lat: 36.1470, lng: 139.3890, lines: ["JR高崎線", "秩父鉄道"], area: "熊谷・深谷・本庄", years: generateYearData(1500, 15) },
  { stationCode: "S091", stationName: "深谷", lat: 36.1970, lng: 139.2810, lines: ["JR高崎線"], area: "熊谷・深谷・本庄", years: generateYearData(1100, 8) },
  { stationCode: "S092", stationName: "本庄", lat: 36.2350, lng: 139.1900, lines: ["JR高崎線"], area: "熊谷・深谷・本庄", years: generateYearData(900, 5) },
];
