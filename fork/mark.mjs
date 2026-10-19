import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const sharp = createRequire(join(root, "apps/app/package.json"))("sharp");

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const len = (a) => Math.hypot(a[0], a[1]);
const norm = (a) => mul(a, 1 / len(a));
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const lerp = (a, b, t) => add(mul(a, 1 - t), mul(b, t));

function cubicAt([p0, p1, p2, p3], t) {
  const u = 1 - t;
  return add(
    add(mul(p0, u * u * u), mul(p1, 3 * u * u * t)),
    add(mul(p2, 3 * u * t * t), mul(p3, t * t * t)),
  );
}

function cubicFrom([p0, p1, p2, p3], t) {
  const p01 = lerp(p0, p1, t);
  const p12 = lerp(p1, p2, t);
  const p23 = lerp(p2, p3, t);
  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);
  return [lerp(p012, p123, t), p123, p23, p3];
}

const KAPPA = 0.5523;
const BEVEL = { blur: 3.2, offset: 3.4, highlight: 0.3, shadow: 0.34 };
const RIM = { width: 2.4, stops: [0.68, 0.38, 0.22] };
const SEAM = { width: 8, rim: 1.2 };

const J1 = [243.173, 132.901];
const P1 = [117.39, 127.537];
const P3 = [8.449, 243.115];
const J2 = [221.66, 343.061];
const TOP_EDGE = [J1, [209.16, 110.325], [161.732, 109.355], P1];
const BOTTOM_EDGE = [[34.741, 360.27], [81.38, 401.497], [162.048, 392.94], J2];
const STEM_TIP_OUTER = [65.95, 29.816];
const STEM_TIP_INNER = [138.53, 49.419];
const ARC_HANDLE = [60, 60];

const down = norm(sub(P3, STEM_TIP_OUTER));
const across = sub(STEM_TIP_INNER, STEM_TIP_OUTER);
const stemWidth = len(across);
const inward = norm(across);
const stemLength = len(sub(P3, STEM_TIP_OUTER));
const radius = stemWidth / 2;

const capCenter = add(add(P3, mul(inward, radius)), mul(down, stemLength));
const capOuter = sub(capCenter, mul(inward, radius));
const capInner = add(capCenter, mul(inward, radius));
const capApex = add(capCenter, mul(down, radius));
const handle = KAPPA * radius;
const cap1 = [
  add(capOuter, mul(down, handle)),
  sub(capApex, mul(inward, handle)),
  capApex,
];
const cap2 = [
  add(capApex, mul(inward, handle)),
  add(capInner, mul(down, handle)),
  capInner,
];

function innerEdgeMeetsBottom() {
  const side = (t) => cross(down, sub(cubicAt(BOTTOM_EDGE, t), capInner));
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (Math.sign(side(mid)) === Math.sign(side(lo))) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const bottomRest = cubicFrom(BOTTOM_EDGE, innerEdgeMeetsBottom());
const Q1 = bottomRest[0];

const topTangent = norm(sub(P1, TOP_EDGE[2]));
const arc = [
  add(P1, mul(topTangent, ARC_HANDLE[0])),
  sub(P3, mul(down, ARC_HANDLE[1])),
  P3,
];

const fmt = (v) => String(Number(v.toFixed(3)));
const pt = (p) => `${fmt(p[0])} ${fmt(p[1])}`;
function path(segments) {
  return segments
    .map(([op, ...points]) => `${op}${points.map(pt).join(" ")}`)
    .join(" ");
}

const descender = [
  ["L", capOuter],
  ["C", ...cap1],
  ["C", ...cap2],
  ["L", Q1],
  ["C", bottomRest[1], bottomRest[2], J2],
];

const rightB = [
  ["C", [226.111, 349.8], [231.053, 354.963], [237.39, 360.565]],
  ["C", [287.404, 404.775], [376.886, 391.327], [437.242, 330.885]],
  ["C", [497.598, 270.443], [506.288, 185.578], [456.275, 141.368]],
  ["C", [422.463, 111.479], [370.582, 107.952], [321.904, 127.469]],
  ["L", [342.81, 49.115]],
  ["C", [348.113, 29.238], [336.312, 8.822], [316.441, 3.498]],
  ["C", [296.555, -1.831], [276.113, 9.971], [270.785, 29.857]],
  ["Z"],
];

const outline = [
  ["M", J1],
  ["C", TOP_EDGE[1], TOP_EDGE[2], P1],
  ["C", ...arc],
  ...descender,
  ...rightB,
];

const rightCounter =
  "M279.815 258.612C282.467 247.201 289.832 224.61 297.282 213.521 323.555 175.201 369.028 158.632 398.847 176.515 428.666 194.398 431.54 239.961 405.266 278.281L404.647 279.174C378.283 316.857 333.288 333.029 303.702 315.286 285.262 304.227 277.126 282.582 279.815 258.612Z";
const leftCounter =
  "M219.168 226.258C218.73 242.98 212.813 261.289 201.226 278.189L200.608 279.083C174.244 316.766 129.249 332.936 99.663 315.193 70.077 297.449 67.626 251.559 93.243 213.428 119.516 175.108 164.988 158.541 194.807 176.423 210.476 185.82 218.698 206.643 219.168 226.258Z";

const markPath = `${path(outline)}${rightCounter}${leftCounter}`;
const lowerSurface = `${path([["M", P3], ...descender])} C246 322 262 286 263 249C243 258 220 270 201.226 278.189L200.608 279.083C174.244 316.766 129.249 332.936 99.663 315.193C79 302.8 70.1 276.5 77.2 251.4C51 258 27 256 ${pt(P3)}Z`;

function bounds() {
  let min = [Infinity, Infinity];
  let max = [-Infinity, -Infinity];
  let current = null;
  const take = (p) => {
    min = [Math.min(min[0], p[0]), Math.min(min[1], p[1])];
    max = [Math.max(max[0], p[0]), Math.max(max[1], p[1])];
  };
  for (const [op, ...points] of outline) {
    if (op === "M" || op === "L") {
      current = points[0];
      take(current);
    } else if (op === "C") {
      const curve = [current, ...points];
      for (let i = 0; i <= 64; i += 1) take(cubicAt(curve, i / 64));
      current = points[2];
    }
  }
  return { min, max, width: max[0] - min[0], height: max[1] - min[1] };
}
export const markBounds = bounds();

export function oklchToHex(L, C, h) {
  const rad = (h * Math.PI) / 180;
  const toRgb = (chroma) => {
    const a = chroma * Math.cos(rad);
    const b = chroma * Math.sin(rad);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
  };
  let chroma = C;
  let rgb = toRgb(chroma);
  while (rgb.some((v) => v < 0 || v > 1) && chroma > 0) {
    chroma -= 0.002;
    rgb = toRgb(chroma);
  }
  const encode = (v) => {
    const c = Math.min(1, Math.max(0, v));
    const srgb = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(srgb * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${rgb.map(encode).join("")}`;
}

export const palette = {
  hue: 40,
  light: {
    back: [
      [0.72, 0.14],
      [0.63, 0.175],
      [0.53, 0.185],
      [0.42, 0.16],
      [0.33, 0.12],
    ],
    lift: 0.03,
  },
  dark: {
    back: [
      [0.84, 0.12],
      [0.76, 0.15],
      [0.67, 0.18],
      [0.58, 0.18],
      [0.49, 0.165],
    ],
    lift: 0.03,
  },
};
const OFFSETS = [0, 0.28, 0.57, 0.82, 1];

function stops(ramp, lift, hue) {
  return ramp
    .map(([L, C], i) => {
      const offset = i === 0 ? "" : ` offset="${OFFSETS[i]}"`;
      return `<stop${offset} stop-color="${oklchToHex(L + lift, C, hue)}"/>`;
    })
    .join("\n      ");
}

export function markSvg(
  variant,
  { standalone = true, palette: colors = palette } = {},
) {
  const ramp = colors[variant];
  const pad = 8;
  const { min, width, height } = markBounds;
  const viewBox = `${fmt(min[0] - pad)} ${fmt(min[1] - pad)} ${fmt(width + 2 * pad)} ${fmt(height + 2 * pad)}`;
  const open = standalone
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-labelledby="title desc">
  <title id="title">pb</title>
  <desc id="desc">Postbeep's pb mark: two interwoven terracotta surfaces with a continuous directional gradient, in the construction of bb's mark.</desc>`
    : "";
  const body = `
  <defs>
    <path id="mark" fill-rule="evenodd" d="${markPath}"/>

    <clipPath id="mark-clip">
      <use href="#mark" clip-rule="evenodd"/>
    </clipPath>

    <path id="foreground-lower" d="${lowerSurface}"/>
    <path id="foreground-center" d="
      M243.173 132.901
      L270.785 29.857
      C276.113 9.971 296.555-1.831 316.441 3.498
      C336.312 8.822 348.113 29.238 342.81 49.115
      L321.904 127.469
      C315 149 306 184 297.282 213.521
      C289.832 224.61 282.467 247.201 279.815 258.612
      C271.888 283.856 256.827 308.983 234.942 330.899
      C230.9 334.947 225.944 339.439 221.66 343.061
      C191 349 176 322 183 292
      C206 274 220 250 219.168 226.258
      L243.173 132.901Z"/>
    <path id="foreground-upper" d="
      M321.904 127.469
      C360 112 406 109 437 129
      C430 149 420 168 408 183
      C405 180 402 178 398.847 176.515
      C369.028 158.632 323.555 175.201 297.282 213.521
      C302 180 310 149 321.904 127.469Z"/>

    <path id="upper-seam" d="M243.173 132.901 219.168 226.258"/>
    <path id="lower-seam" d="M221.66 343.061C247.234 321.797 270.309 286.682 279.815 258.612"/>

    <linearGradient id="background-fill" x1="74" y1="18" x2="424" y2="377" gradientUnits="userSpaceOnUse">
      ${stops(ramp.back, 0, colors.hue)}
    </linearGradient>
    <linearGradient id="foreground-fill" x1="74" y1="18" x2="424" y2="377" gradientUnits="userSpaceOnUse">
      ${stops(ramp.back, ramp.lift, colors.hue)}
    </linearGradient>
    <linearGradient id="lower-fade" x1="8" y1="0" x2="118" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#fff" stop-opacity="0"/>
      <stop offset=".58" stop-color="#fff" stop-opacity=".72"/>
      <stop offset="1" stop-color="#fff"/>
    </linearGradient>
    <linearGradient id="upper-fade" x1="355" y1="0" x2="439" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="#fff"/>
      <stop offset=".42" stop-color="#fff" stop-opacity=".88"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="lower-mask" maskUnits="userSpaceOnUse" x="-80" y="190" width="360" height="340">
      <rect x="-80" y="190" width="360" height="340" fill="url(#lower-fade)"/>
    </mask>
    <mask id="upper-mask" maskUnits="userSpaceOnUse" x="286" y="96" width="170" height="128">
      <rect x="286" y="96" width="170" height="128" fill="url(#upper-fade)"/>
    </mask>
    <linearGradient id="outline" x1="62" y1="10" x2="438" y2="382" gradientUnits="userSpaceOnUse">
      <stop stop-color="#fff" stop-opacity=".23"/>
      <stop offset=".4" stop-color="#fff" stop-opacity=".06"/>
      <stop offset=".66" stop-color="#000" stop-opacity=".42"/>
      <stop offset="1" stop-color="#000" stop-opacity=".72"/>
    </linearGradient>
    <linearGradient id="upper-shadow" x1="241" y1="141" x2="223" y2="211" gradientUnits="userSpaceOnUse">
      <stop stop-color="#000" stop-opacity="0"/>
      <stop offset=".2" stop-color="#000" stop-opacity=".48"/>
      <stop offset=".78" stop-color="#000" stop-opacity=".5"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="lower-shadow" x1="229" y1="336" x2="275" y2="270" gradientUnits="userSpaceOnUse">
      <stop stop-color="#000" stop-opacity="0"/>
      <stop offset=".22" stop-color="#000" stop-opacity=".5"/>
      <stop offset=".76" stop-color="#000" stop-opacity=".54"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="upper-rim" x1="243.173" y1="132.901" x2="219.168" y2="226.258" gradientUnits="userSpaceOnUse">
      <stop stop-color="#fff" stop-opacity="0"/>
      <stop offset=".16" stop-color="#fff" stop-opacity=".2"/>
      <stop offset=".82" stop-color="#fff" stop-opacity=".13"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="lower-rim" x1="221.66" y1="343.061" x2="279.815" y2="258.612" gradientUnits="userSpaceOnUse">
      <stop stop-color="#fff" stop-opacity="0"/>
      <stop offset=".16" stop-color="#fff" stop-opacity=".16"/>
      <stop offset=".8" stop-color="#fff" stop-opacity=".11"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>

    <clipPath id="upper-underlap">
      <path d="M-80-40H243.173L219.168 226.258-80 560Z"/>
    </clipPath>
    <clipPath id="lower-underlap">
      <path d="M221.66 343.061C247.234 321.797 270.309 286.682 279.815 258.612L540-40V560H-80Z"/>
    </clipPath>
    <filter id="seam-blur" x="-45%" y="-45%" width="190%" height="190%" color-interpolation-filters="sRGB">
      <feGaussianBlur stdDeviation="2.1"/>
    </filter>
    <filter id="bevel" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="${BEVEL.blur}" result="soft"/>
      <feOffset in="soft" dx="${BEVEL.offset}" dy="${BEVEL.offset}" result="soft-lower"/>
      <feComposite in="SourceAlpha" in2="soft-lower" operator="out" result="lit-band"/>
      <feFlood flood-color="#fff" flood-opacity="${BEVEL.highlight}" result="light"/>
      <feComposite in="light" in2="lit-band" operator="in" result="lit"/>
      <feOffset in="soft" dx="-${BEVEL.offset}" dy="-${BEVEL.offset}" result="soft-upper"/>
      <feComposite in="SourceAlpha" in2="soft-upper" operator="out" result="shade-band"/>
      <feFlood flood-color="#000" flood-opacity="${BEVEL.shadow}" result="dark"/>
      <feComposite in="dark" in2="shade-band" operator="in" result="shade"/>
      <feMerge>
        <feMergeNode in="SourceGraphic"/>
        <feMergeNode in="lit"/>
        <feMergeNode in="shade"/>
      </feMerge>
    </filter>
    <linearGradient id="rim" x1="62" y1="10" x2="438" y2="382" gradientUnits="userSpaceOnUse">
      <stop stop-color="#fff" stop-opacity="${RIM.stops[0]}"/>
      <stop offset=".45" stop-color="#fff" stop-opacity="${RIM.stops[1]}"/>
      <stop offset="1" stop-color="#fff" stop-opacity="${RIM.stops[2]}"/>
    </linearGradient>
  </defs>

  <g filter="url(#bevel)">
    <use href="#mark" fill="url(#background-fill)" fill-rule="evenodd"/>

    <g clip-path="url(#mark-clip)">
      <use href="#foreground-lower" fill="url(#foreground-fill)" mask="url(#lower-mask)"/>
      <use href="#foreground-center" fill="url(#foreground-fill)"/>
      <use href="#foreground-upper" fill="url(#foreground-fill)" mask="url(#upper-mask)"/>
    </g>

    <g clip-path="url(#mark-clip)">
      <g clip-path="url(#upper-underlap)">
        <path d="M240.8 142.2 224.2 207.2" fill="none" stroke="url(#upper-shadow)" stroke-width="${SEAM.width}" stroke-linecap="butt" filter="url(#seam-blur)"/>
      </g>
      <g clip-path="url(#lower-underlap)">
        <path d="M228.5 335.5C246 320 263 294 274.5 270.5" fill="none" stroke="url(#lower-shadow)" stroke-width="${SEAM.width + 1}" stroke-linecap="butt" filter="url(#seam-blur)"/>
      </g>
    </g>
  </g>

  <g clip-path="url(#mark-clip)">
    <use href="#mark" fill="none" stroke="url(#rim)" stroke-width="${RIM.width}" stroke-linejoin="round" fill-rule="evenodd"/>
  </g>
  <use href="#upper-seam" fill="none" stroke="url(#upper-rim)" stroke-width="${SEAM.rim}"/>
  <use href="#lower-seam" fill="none" stroke="url(#lower-rim)" stroke-width="${SEAM.rim}"/>
  <use href="#mark" fill="none" stroke="url(#outline)" stroke-width=".8" stroke-linejoin="round" fill-rule="evenodd"/>
`;
  return standalone ? `${open}${body}</svg>\n` : body;
}

export const PIXELS_PER_UNIT = 570 / 490.3;

function placed(
  variant,
  canvas,
  { background = null, scale = PIXELS_PER_UNIT },
) {
  const { min, width, height } = markBounds;
  const w = width * scale;
  const h = height * scale;
  const x = (canvas[0] - w) / 2 - min[0] * scale;
  const y = (canvas[1] - h) / 2 - min[1] * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas[0]}" height="${canvas[1]}" viewBox="0 0 ${canvas[0]} ${canvas[1]}">
${background ?? ""}
<g transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale)})">${markSvg(variant, { standalone: false })}</g>
</svg>`;
}

function superellipse(cx, cy, a, exponent, steps = 720) {
  const points = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (2 * Math.PI * i) / steps;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const x = cx + a * Math.sign(c) * Math.abs(c) ** (2 / exponent);
    const y = cy + a * Math.sign(s) * Math.abs(s) ** (2 / exponent);
    points.push(`${fmt(x)} ${fmt(y)}`);
  }
  return `<path fill="#fff" d="M${points.join("L")}Z"/>`;
}

export const compositions = {
  "apps/mobile/assets/fork/icon.png": () =>
    placed("light", [1024, 1024], {
      background: '<rect width="1024" height="1024" fill="#fff"/>',
    }),
  "apps/mobile/assets/fork/icon-dark.png": () =>
    placed("dark", [1024, 1024], {}),
  "apps/mobile/assets/fork/splash-logo.png": () => splashLogo("light"),
  "apps/mobile/assets/fork/splash-logo-dark.png": () => splashLogo("dark"),
  "fork/desktop/icon.png": () =>
    placed("light", [1024, 1024], {
      background: superellipse(512, 512, 424.5, 4),
    }),
};

export const SPLASH_PADDING = 6;
export function splashCanvas() {
  return [
    Math.round(markBounds.width * PIXELS_PER_UNIT) + 2 * SPLASH_PADDING,
    Math.round(markBounds.height * PIXELS_PER_UNIT) + 2 * SPLASH_PADDING,
  ];
}
function splashLogo(variant) {
  return placed(variant, splashCanvas(), {});
}

async function render(svg, file, { opaque = false } = {}) {
  let image = sharp(Buffer.from(svg)).png({ compressionLevel: 9 });
  if (opaque) image = image.flatten({ background: "#fff" }).removeAlpha();
  mkdirSync(dirname(file), { recursive: true });
  await image.toFile(file);
}

async function writeIcns(sourcePng, file) {
  const dir = mkdtempSync(join(tmpdir(), "pb-icon-"));
  const iconset = join(dir, "icon.iconset");
  mkdirSync(iconset);
  for (const size of [16, 32, 128, 256, 512]) {
    for (const factor of [1, 2]) {
      const name = `icon_${size}x${size}${factor === 2 ? "@2x" : ""}.png`;
      await sharp(sourcePng)
        .resize(size * factor, size * factor, { kernel: "lanczos3" })
        .png({ compressionLevel: 9 })
        .toFile(join(iconset, name));
    }
  }
  try {
    execFileSync("iconutil", ["-c", "icns", iconset, "-o", file]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main() {
  const outDir = process.argv.includes("--out")
    ? process.argv[process.argv.indexOf("--out") + 1]
    : root;
  mkdirSync(join(outDir, "fork"), { recursive: true });
  writeFileSync(join(outDir, "fork/mark.svg"), markSvg("light"));
  writeFileSync(join(outDir, "fork/mark-dark.svg"), markSvg("dark"));
  for (const [file, svg] of Object.entries(compositions)) {
    await render(svg(), join(outDir, file), {
      opaque: file.endsWith("/icon.png") && file.startsWith("apps/"),
    });
  }
  if (process.platform === "darwin") {
    await writeIcns(
      join(outDir, "fork/desktop/icon.png"),
      join(outDir, "fork/desktop/icon.icns"),
    );
  }
  const { width, height } = markBounds;
  console.log(
    `mark ${fmt(width)} x ${fmt(height)} units; splash ${splashCanvas().join("x")} px`,
  );
  for (const variant of ["light", "dark"]) {
    const ramp = palette[variant];
    console.log(
      variant,
      ramp.back.map(([L, C]) => oklchToHex(L, C, palette.hue)).join(" "),
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
