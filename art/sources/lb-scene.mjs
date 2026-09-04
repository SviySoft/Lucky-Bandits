import { page, grad, rgrad, material, lighting, dropShadow, PAL } from '../lib.mjs';

const goldDefs = `
  ${material('goldm', PAL.gold, { cx: '34%', cy: '18%' })}
  ${material('goldDeep', PAL.goldDeep)}
  ${lighting('lit', { soft: 22, scale: 5.5, spec: 1.15, exp: 20 })}
  ${lighting('litSoft', { soft: 14, scale: 3.6, spec: 0.9, exp: 26 })}
  ${lighting('litSmall', { soft: 7, scale: 2.6, spec: 1.2, exp: 20 })}
  ${dropShadow('shadow', { dy: 20, blur: 18, opacity: 0.5 })}
`;

/* ================================ EFFECTS ==================================== */
const coin = page(
  256, 256,
  `<g filter="url(#lit)"><circle cx="128" cy="128" r="112" fill="url(#goldm)"/></g>
   <circle cx="128" cy="128" r="112" fill="none" stroke="#5c3a04" stroke-width="9" opacity="0.6"/>
   <circle cx="128" cy="128" r="82" fill="none" stroke="#fff0b8" stroke-width="7" opacity="0.6"/>
   <text x="128" y="172" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial" font-size="120"
         font-weight="900" fill="#8a5406" opacity="0.8">$</text>`,
  goldDefs,
);

const gemFx = page(
  256, 256,
  `<g filter="url(#litSoft)"><path d="M 128,26 L 226,110 L 128,230 L 30,110 Z" fill="url(#gemM)"/></g>
   <path d="M 30,110 L 226,110 L 128,230 Z" fill="#ffffff" opacity="0.2"/>
   <path d="M 128,26 L 226,110 L 128,230 L 30,110 Z" fill="none" stroke="#eafcff" stroke-width="7"/>`,
  `${goldDefs}${rgrad('gemM', [[0, '#ffffff'], [0.35, '#d8f6ff'], [0.7, '#6ec8f0'], [1, '#1f6fa8']], '36%', '26%', '80%')}`,
);

const noteFx = page(
  256, 160,
  `<g filter="url(#litSmall)"><rect x="8" y="12" width="240" height="136" rx="12" fill="url(#noteM)"/></g>
   <rect x="24" y="28" width="208" height="104" rx="8" fill="none" stroke="#0d4f33" stroke-width="5" opacity="0.5"/>
   <circle cx="128" cy="80" r="34" fill="#0d4f33" opacity="0.3"/>
   <text x="128" y="98" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial" font-size="54"
         font-weight="900" fill="#0d4f33" opacity="0.75">$</text>`,
  `${goldDefs}${grad('noteM', [[0, '#bdf0cd'], [0.5, '#6fd196'], [1, '#31955f']])}`,
);

const lockFx = page(
  512, 512,
  `<g filter="url(#lit)">
     <path d="M 156,236 L 156,168 C 156,96 210,54 256,54 C 302,54 356,96 356,168 L 356,236"
           fill="none" stroke="url(#steelM)" stroke-width="52" stroke-linecap="round"/>
     <rect x="96" y="228" width="320" height="248" rx="46" fill="url(#goldm)"/>
   </g>
   <rect x="96" y="228" width="320" height="248" rx="46" fill="none" stroke="#5c3a04" stroke-width="12" opacity="0.6"/>
   <circle cx="256" cy="330" r="36" fill="#3d2a08"/>
   <path d="M 240,346 L 272,346 L 282,424 L 230,424 Z" fill="#3d2a08"/>`,
  `${goldDefs}${material('steelM', ['#ffffff', '#c8d4e6', '#7d8aa0', '#3d4658'])}`,
);

const burst = page(
  1024, 1024,
  `${Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2;
    const rr = i % 2 ? 300 : 500;
    return `<path d="M 512,512 L ${(512 + Math.cos(a - 0.045) * rr).toFixed(0)},${(512 + Math.sin(a - 0.045) * rr).toFixed(0)} L ${(512 + Math.cos(a + 0.045) * rr).toFixed(0)},${(512 + Math.sin(a + 0.045) * rr).toFixed(0)} Z" fill="#ffe9a8" opacity="${i % 2 ? 0.22 : 0.4}"/>`;
  }).join('')}
  <circle cx="512" cy="512" r="300" fill="url(#coreGlow)"/>`,
  `${rgrad('coreGlow', [[0, '#fffbe8', 0.9], [0.4, '#ffd257', 0.45], [1, '#ffb43c', 0]], '50%', '50%', '50%')}`,
);

export const assets = [
  { id: 'fx_coin', out: 'effects/coin.png', width: 256, height: 256, html: coin },
  { id: 'fx_gem', out: 'effects/gem.png', width: 256, height: 256, html: gemFx },
  { id: 'fx_note', out: 'effects/note.png', width: 256, height: 160, html: noteFx },
  { id: 'fx_lock', out: 'effects/lock.png', width: 512, height: 512, html: lockFx },
  { id: 'fx_burst', out: 'effects/burst.png', width: 1024, height: 1024, html: burst },
];
