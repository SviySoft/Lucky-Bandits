/**
 * LUCKY BANDITS — art library.
 *
 * Artwork is authored here as SVG and *pre-rendered offline* into PNG/WebP assets by
 * tools/render-assets.mjs (headless Chrome). The game never draws artwork at runtime —
 * it only loads finished textures. Swapping in artwork from a 3D artist means dropping
 * files into assets/ with the same names; no game code changes.
 *
 * The 3D look comes from SVG lighting filters: the alpha channel of a shape is blurred
 * into a height field, then feDiffuseLighting + feSpecularLighting shade it. That is a
 * real (if cheap) renderer, which is why the output reads as sculpted rather than flat.
 */

export const PAL = {
  gold: ['#fff6cf', '#ffd257', '#e0a41c', '#a96c08', '#6b4104'],
  goldDeep: ['#ffe9a8', '#f0b32a', '#a86f0c', '#5c3a04'],
  red: ['#ffd9d0', '#ff6b52', '#d62828', '#7d1414'],
  purple: ['#f0d9ff', '#b06bff', '#7b2ff7', '#3d1178'],
  blue: ['#d6ecff', '#4fa8ff', '#1f5fd6', '#0d2c6b'],
  green: ['#dcffe4', '#5ddb7a', '#1fa14a', '#0b5626'],
  skin: ['#ffe0c4', '#f7c49a', '#d99b6c', '#a86a3f'],
  skinDark: ['#e8c09a', '#c98f5f', '#9c6034', '#6b3f1f'],
  suit: ['#5a6480', '#2c3450', '#141a2e', '#080b16'],
  teal: ['#d3fff4', '#4fe3c1', '#12a184', '#065045'],
  pink: ['#ffdcef', '#ff7ab8', '#e0348a', '#7d1246'],
  silver: ['#ffffff', '#dbe4f0', '#94a3bd', '#4e5a72'],
};

/** linear gradient, top-light by default */
export function grad(id, stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
  const body = stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`)
    .join('');
  return `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${body}</linearGradient>`;
}

export function rgrad(id, stops, cx = '38%', cy = '32%', r = '70%') {
  const body = stops
    .map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a !== undefined ? ` stop-opacity="${a}"` : ''}/>`)
    .join('');
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${body}</radialGradient>`;
}

/** ramp helper: four-stop material from a palette array */
export function material(id, pal, { cx = '36%', cy = '28%' } = {}) {
  return rgrad(
    id,
    [
      [0, pal[0]],
      [0.35, pal[1]],
      [0.72, pal[2]],
      [1, pal[3]],
    ],
    cx,
    cy,
    '78%',
  );
}

/**
 * The workhorse: turns a flat silhouette into a lit, rounded volume.
 * `soft` controls how inflated it looks, `lx/ly/lz` place the key light.
 */
export function lighting(
  id,
  { soft = 22, scale = 5, lx = 0.28, ly = 0.16, lz = 260, spec = 1.05, exp = 26, diffuse = 1.0, color = '#ffffff' } = {},
) {
  return `
<filter id="${id}" x="-35%" y="-35%" width="170%" height="170%" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="${soft}" result="bump"/>
  <feSpecularLighting in="bump" surfaceScale="${scale}" specularConstant="${spec}" specularExponent="${exp}"
      lighting-color="${color}" result="spec">
    <fePointLight x="LX" y="LY" z="${lz}"/>
  </feSpecularLighting>
  <feComposite in="spec" in2="SourceAlpha" operator="in" result="specClip"/>
  <feDiffuseLighting in="bump" surfaceScale="${scale}" diffuseConstant="${diffuse}" lighting-color="#ffffff" result="diff">
    <fePointLight x="LX" y="LY" z="${lz}"/>
  </feDiffuseLighting>
  <feComposite in="diff" in2="SourceAlpha" operator="in" result="diffClip"/>
  <feComposite in="SourceGraphic" in2="diffClip" operator="arithmetic" k1="0.85" k2="0.35" k3="0" k4="0" result="shaded"/>
  <feComposite in="shaded" in2="specClip" operator="arithmetic" k1="0" k2="1" k3="0.85" k4="0" result="final"/>
</filter>`.replace(/LX/g, String(Math.round(1024 * lx))).replace(/LY/g, String(Math.round(1024 * ly)));
}

/** ambient occlusion / contact shadow under an element */
export function dropShadow(id, { dx = 0, dy = 26, blur = 22, opacity = 0.55, color = '#1a0d04' } = {}) {
  return `<filter id="${id}" x="-40%" y="-40%" width="180%" height="180%">
    <feDropShadow dx="${dx}" dy="${dy}" stdDeviation="${blur}" flood-color="${color}" flood-opacity="${opacity}"/>
  </filter>`;
}

/** outer glow used behind premium symbols */
export function glow(id, { blur = 26, color = '#ffcf4a', opacity = 0.9 } = {}) {
  return `<filter id="${id}" x="-60%" y="-60%" width="220%" height="220%">
    <feDropShadow dx="0" dy="0" stdDeviation="${blur}" flood-color="${color}" flood-opacity="${opacity}"/>
  </filter>`;
}

/** subtle surface grain so large flats do not look like plastic */
export function grain(id, { freq = 0.9, oct = 3, opacity = 0.12 } = {}) {
  return `<filter id="${id}" x="0%" y="0%" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${oct}" result="n"/>
    <feColorMatrix in="n" type="saturate" values="0" result="g"/>
    <feComponentTransfer in="g" result="gg"><feFuncA type="linear" slope="${opacity}"/></feComponentTransfer>
    <feComposite in="gg" in2="SourceAlpha" operator="in" result="grainClip"/>
    <feBlend in="SourceGraphic" in2="grainClip" mode="overlay"/>
  </filter>`;
}

/** a thick cartoon outline: draw the shape twice, dark and fat underneath */
export function outlined(d, fill, { stroke = '#2a1405', width = 14, filter = '' } = {}) {
  return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>
          <path d="${d}" fill="${fill}"${filter ? ` filter="${filter}"` : ''}/>`;
}

/** wraps the finished SVG into a page the rasteriser can screenshot */
export function page(width, height, body, defs = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:transparent;overflow:hidden}
  svg{display:block}
  </style></head><body>
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>${defs}</defs>
    ${body}
  </svg></body></html>`;
}

/** deterministic pseudo random for scattered decoration */
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
