const FRAME_RATE = 30;
const DURATION = 120;

const hexToLottie = (hex) => {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b, 1];
};

const ease = {
  i: { x: [0.667, 0.667, 0.667], y: [1, 1, 1] },
  o: { x: [0.333, 0.333, 0.333], y: [0, 0, 0] },
};

const staticTransform = (x, y, scale = 100, opacity = 100) => ({
  o: { a: 0, k: opacity },
  r: { a: 0, k: 0 },
  p: { a: 0, k: [x, y, 0] },
  a: { a: 0, k: [0, 0, 0] },
  s: { a: 0, k: [scale, scale, 100] },
});

const scaleInTransform = (x, y, start, end, scale = 100) => ({
  o: {
    a: 1,
    k: [
      { ...ease, t: start, s: [0], e: [100] },
      { t: end, s: [100] },
    ],
  },
  r: { a: 0, k: 0 },
  p: { a: 0, k: [x, y, 0] },
  a: { a: 0, k: [0, 0, 0] },
  s: {
    a: 1,
    k: [
      { ...ease, t: start, s: [scale, 8, 100], e: [scale, scale, 100] },
      { t: end, s: [scale, scale, 100] },
    ],
  },
});

const rectShape = (width, height, fill, radius = 14) => ({
  ty: "gr",
  it: [
    {
      ty: "rc",
      d: 1,
      s: { a: 0, k: [width, height] },
      p: { a: 0, k: [0, 0] },
      r: { a: 0, k: radius },
    },
    { ty: "fl", c: { a: 0, k: hexToLottie(fill) }, o: { a: 0, k: 100 }, r: 1 },
    {
      ty: "tr",
      p: { a: 0, k: [0, 0] },
      a: { a: 0, k: [0, 0] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      sk: { a: 0, k: 0 },
      sa: { a: 0, k: 0 },
    },
  ],
});

const ellipseShape = (width, height, fill) => ({
  ty: "gr",
  it: [
    {
      ty: "el",
      d: 1,
      s: { a: 0, k: [width, height] },
      p: { a: 0, k: [0, 0] },
    },
    { ty: "fl", c: { a: 0, k: hexToLottie(fill) }, o: { a: 0, k: 100 }, r: 1 },
    {
      ty: "tr",
      p: { a: 0, k: [0, 0] },
      a: { a: 0, k: [0, 0] },
      s: { a: 0, k: [100, 100] },
      r: { a: 0, k: 0 },
      o: { a: 0, k: 100 },
      sk: { a: 0, k: 0 },
      sa: { a: 0, k: 0 },
    },
  ],
});

const layer = (ind, name, shapes, ks, ip = 0, op = DURATION) => ({
  ddd: 0,
  ind,
  ty: 4,
  nm: name,
  sr: 1,
  ks,
  ao: 0,
  shapes: Array.isArray(shapes) ? shapes : [shapes],
  ip,
  op,
  st: 0,
  bm: 0,
});

const baseAnimation = (name, layers) => ({
  v: "5.9.0",
  fr: FRAME_RATE,
  ip: 0,
  op: DURATION,
  w: 512,
  h: 512,
  nm: name,
  ddd: 0,
  assets: [],
  layers,
});

function growthChart() {
  return baseAnimation("Business growth chart", [
    layer(1, "bar-small", rectShape(54, 150, "#38bdf8"), scaleInTransform(150, 350, 4, 26)),
    layer(2, "bar-mid", rectShape(54, 230, "#a78bfa"), scaleInTransform(236, 310, 14, 38)),
    layer(3, "bar-tall", rectShape(54, 310, "#34d399"), scaleInTransform(322, 270, 24, 50)),
    layer(4, "dot-1", ellipseShape(28, 28, "#ffffff"), staticTransform(150, 180, 100, 86)),
    layer(5, "dot-2", ellipseShape(28, 28, "#ffffff"), staticTransform(236, 132, 100, 86)),
    layer(6, "dot-3", ellipseShape(28, 28, "#ffffff"), staticTransform(322, 72, 100, 86)),
  ]);
}

function dashboardFlow() {
  return baseAnimation("SaaS dashboard flow", [
    layer(1, "window", rectShape(330, 240, "#ffffff", 26), staticTransform(256, 260, 100, 92)),
    layer(2, "sidebar", rectShape(70, 200, "#1d4ed8", 18), staticTransform(126, 260)),
    layer(3, "card-a", rectShape(160, 54, "#a78bfa", 14), scaleInTransform(270, 190, 6, 24)),
    layer(4, "card-b", rectShape(160, 54, "#38bdf8", 14), scaleInTransform(270, 260, 16, 34)),
    layer(5, "card-c", rectShape(160, 54, "#34d399", 14), scaleInTransform(270, 330, 26, 44)),
    layer(6, "pulse", ellipseShape(46, 46, "#fbbf24"), scaleInTransform(410, 170, 36, 56)),
  ]);
}

function megaphone() {
  return baseAnimation("Marketing megaphone", [
    layer(1, "handle", rectShape(46, 138, "#111827", 18), staticTransform(204, 332, 100)),
    layer(2, "speaker", rectShape(220, 138, "#f43f5e", 26), scaleInTransform(282, 240, 6, 28)),
    layer(3, "mouth", rectShape(64, 190, "#fde68a", 24), staticTransform(398, 240, 100)),
    layer(4, "sound-1", ellipseShape(44, 44, "#ffffff"), scaleInTransform(430, 170, 16, 38)),
    layer(5, "sound-2", ellipseShape(32, 32, "#ffffff"), scaleInTransform(456, 110, 28, 52)),
  ]);
}

function profileIntro() {
  return baseAnimation("Personal profile intro", [
    layer(1, "avatar-bg", ellipseShape(230, 230, "#a78bfa"), scaleInTransform(256, 214, 4, 34)),
    layer(2, "avatar-head", ellipseShape(82, 82, "#ffffff"), staticTransform(256, 180, 100)),
    layer(3, "avatar-body", rectShape(154, 90, "#ffffff", 46), staticTransform(256, 286, 100)),
    layer(4, "badge", ellipseShape(78, 78, "#34d399"), scaleInTransform(338, 322, 30, 52)),
  ]);
}

function localStore() {
  return baseAnimation("Local store offer", [
    layer(1, "store", rectShape(260, 190, "#ffffff", 22), staticTransform(256, 300, 100, 94)),
    layer(2, "awning", rectShape(292, 70, "#f43f5e", 18), scaleInTransform(256, 190, 8, 30)),
    layer(3, "door", rectShape(64, 120, "#1d4ed8", 14), staticTransform(256, 336, 100)),
    layer(4, "sale", rectShape(104, 54, "#fbbf24", 18), scaleInTransform(356, 246, 24, 46)),
    layer(5, "pin", ellipseShape(46, 46, "#34d399"), scaleInTransform(154, 236, 34, 54)),
  ]);
}

export const lottieCatalog = [
  {
    id: "business-growth-chart",
    category: "business",
    label: "Growth chart",
    animationData: growthChart(),
  },
  {
    id: "saas-dashboard-flow",
    category: "saas",
    label: "Dashboard flow",
    animationData: dashboardFlow(),
  },
  {
    id: "marketing-megaphone",
    category: "marketing",
    label: "Campaign megaphone",
    animationData: megaphone(),
  },
  {
    id: "personal-profile-intro",
    category: "personal",
    label: "Profile intro",
    animationData: profileIntro(),
  },
  {
    id: "local-store-offer",
    category: "local-business",
    label: "Store offer",
    animationData: localStore(),
  },
];

export function getLottieAsset(id) {
  return lottieCatalog.find((asset) => asset.id === id) || lottieCatalog[0];
}
