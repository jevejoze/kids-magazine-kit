// 角色 SVG 2.0：绘本级矢量插画，精致层次与专属萌点
const INK = "#3A2A20";
const S = `stroke="${INK}" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"`;

const CH_DEFS = `
<defs>
  <linearGradient id="ch_dogFur" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFF8E7"/><stop offset="100%" stop-color="#FCEFD2"/></linearGradient>
  <linearGradient id="ch_dogEarL" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#EAA66B"/><stop offset="100%" stop-color="#D2884A"/></linearGradient>
  <linearGradient id="ch_dogEarR" x1="1" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#EAA66B"/><stop offset="100%" stop-color="#D2884A"/></linearGradient>
  <linearGradient id="ch_owlBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#D8A573"/><stop offset="100%" stop-color="#BC8654"/></linearGradient>
  <linearGradient id="ch_owlBelly" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFF5E5"/><stop offset="100%" stop-color="#F2DEC5"/></linearGradient>
  <linearGradient id="ch_mouseFur" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FAF5FC"/><stop offset="100%" stop-color="#ECE2F0"/></linearGradient>
  <linearGradient id="ch_mouseEar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#FFBCCB"/><stop offset="100%" stop-color="#FF99AF"/></linearGradient>
  <linearGradient id="ch_teaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#EED0AC"/><stop offset="100%" stop-color="#CFA477"/></linearGradient>
  <linearGradient id="ch_raccoonFur" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#D6D6DE"/><stop offset="100%" stop-color="#B8B8C4"/></linearGradient>
  <linearGradient id="ch_lensGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#EBF6FF" stop-opacity="0.85"/><stop offset="100%" stop-color="#BFE2FF" stop-opacity="0.45"/></linearGradient>
</defs>
`;

function eyes(m, lx, rx, y, r = 7.5, isDarkMask = false) {
  if (m === "happy" || m === "smirk" || m === "wave") {
    const col = isDarkMask ? "#fff" : INK;
    return `
      <path d="M${lx-11} ${y+3} q11 -14 22 0" stroke="${col}" stroke-width="5.5" fill="none" stroke-linecap="round"/>
      <path d="M${rx-11} ${y+3} q11 -14 22 0" stroke="${col}" stroke-width="5.5" fill="none" stroke-linecap="round"/>
    `;
  }
  if (m === "sleepy") {
    const col = isDarkMask ? "#fff" : INK;
    return `
      <path d="M${lx-10} ${y} q10 10 20 0" stroke="${col}" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M${rx-10} ${y} q10 10 20 0" stroke="${col}" stroke-width="5" fill="none" stroke-linecap="round"/>
    `;
  }
  if (m === "angry") {
    const browCol = isDarkMask ? "#fff" : INK;
    return `
      <circle cx="${lx}" cy="${y+2}" r="${r}" fill="${INK}"/>
      <circle cx="${rx}" cy="${y+2}" r="${r}" fill="${INK}"/>
      <circle cx="${lx+2}" cy="${y}" r="2.5" fill="#fff"/>
      <circle cx="${rx+2}" cy="${y}" r="2.5" fill="#fff"/>
      <path d="M${lx-14} ${y-15} l24 10" stroke="${browCol}" stroke-width="5.5" stroke-linecap="round"/>
      <path d="M${rx+14} ${y-15} l-24 10" stroke="${browCol}" stroke-width="5.5" stroke-linecap="round"/>
    `;
  }
  const rr = m === "surprise" ? r + 3 : r;
  if (isDarkMask) {
    return `
      <circle cx="${lx}" cy="${y}" r="${rr+3.5}" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>
      <circle cx="${rx}" cy="${y}" r="${rr+3.5}" fill="#FFFFFF" stroke="${INK}" stroke-width="2"/>
      <circle cx="${lx}" cy="${y}" r="${rr-1}" fill="${INK}"/>
      <circle cx="${rx}" cy="${y}" r="${rr-1}" fill="${INK}"/>
      <circle cx="${lx+2.5}" cy="${y-2.5}" r="2.5" fill="#FFFFFF"/>
      <circle cx="${rx+2.5}" cy="${y-2.5}" r="2.5" fill="#FFFFFF"/>
      <circle cx="${lx-2.5}" cy="${y+2.5}" r="1.2" fill="#FFFFFF" opacity="0.8"/>
      <circle cx="${rx-2.5}" cy="${y+2.5}" r="1.2" fill="#FFFFFF" opacity="0.8"/>
    `;
  }
  return `
    <circle cx="${lx}" cy="${y}" r="${rr}" fill="${INK}"/>
    <circle cx="${rx}" cy="${y}" r="${rr}" fill="${INK}"/>
    <circle cx="${lx+2.5}" cy="${y-2.5}" r="2.6" fill="#fff"/>
    <circle cx="${rx+2.5}" cy="${y-2.5}" r="2.6" fill="#fff"/>
    <circle cx="${lx-2.5}" cy="${y+2.5}" r="1.3" fill="#fff" opacity="0.75"/>
    <circle cx="${rx-2.5}" cy="${y+2.5}" r="1.3" fill="#fff" opacity="0.75"/>
  `;
}

function mouth(m, x, y) {
  if (m === "surprise") return `<ellipse cx="${x}" cy="${y+6}" rx="8" ry="11" fill="${INK}" stroke="${INK}" stroke-width="2"/>`;
  if (m === "angry") return `<path d="M${x-12} ${y+9} q12 -9 24 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  if (m === "talk") return `
    <path d="M${x-14} ${y+1} q14 20 28 0 z" fill="#FF7B7B" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
    <path d="M${x-8} ${y+12} q8 8 16 0" fill="#FFA5A5"/>
  `;
  if (m === "think") return `<path d="M${x-9} ${y+5} h18" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  if (m === "smirk") return `
    <path d="M${x-14} ${y+3} q16 14 28 -7" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M${x+12} ${y-3} l2 -4" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  `;
  return `<path d="M${x-14} ${y} q7 9 14 0 q7 9 14 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
}

const blush = (a, b, y) => `
  <ellipse cx="${a}" cy="${y}" rx="14" ry="8.5" fill="#FF8CA3" opacity=".7"/>
  <ellipse cx="${b}" cy="${y}" rx="14" ry="8.5" fill="#FF8CA3" opacity=".7"/>
`;

const paws = (fill, x1 = 65, x2 = 135, y = 188) => `
  <g class="paws">
    <ellipse cx="${x1}" cy="${y}" rx="16" ry="12" fill="${fill}" ${S}/>
    <ellipse cx="${x2}" cy="${y}" rx="16" ry="12" fill="${fill}" ${S}/>
    <path d="M${x1-6} ${y-2} v7 M${x1+6} ${y-2} v7 M${x2-6} ${y-2} v7 M${x2+6} ${y-2} v7" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>
  </g>
`;

const CH = {
  dog: (m, prop = "") => `
    <ellipse cx="100" cy="180" rx="60" ry="24" fill="#E8D1B5" opacity=".4"/>
    <path d="M38 78 C10 88 4 135 24 146 C38 154 54 138 52 108 Z" fill="url(#ch_dogEarL)" ${S}/>
    <path d="M22 106 C18 126 26 138 34 136" stroke="#C57535" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M162 78 C190 88 196 135 176 146 C162 154 146 138 148 108 Z" fill="url(#ch_dogEarR)" ${S}/>
    <path d="M178 106 C182 126 174 138 166 136" stroke="#C57535" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M34 116 C30 80 55 58 100 58 C145 58 170 80 166 116 C164 154 146 172 100 172 C54 172 36 154 34 116 Z" fill="url(#ch_dogFur)" ${S}/>
    <path d="M94 66 q6 -8 12 0" stroke="#FFE9BE" stroke-width="3" stroke-linecap="round" fill="none"/>
    <ellipse cx="100" cy="134" rx="28" ry="20" fill="#FFFFFF"/>
    <path d="M91 123 C91 118 109 118 109 123 C109 130 101 133 100 133 C99 133 91 130 91 123 Z" fill="${INK}" stroke="${INK}" stroke-width="1.5"/>
    <ellipse cx="97" cy="122" rx="3" ry="1.8" fill="#FFFFFF"/>
    ${eyes(m, 68, 132, 110, 7.5)}
    ${mouth(m, 100, 139)}
    ${blush(52, 148, 134)}
    <ellipse cx="68" cy="94" rx="5" ry="3.5" fill="#E8B88A" opacity=".85"/>
    <ellipse cx="132" cy="94" rx="5" ry="3.5" fill="#E8B88A" opacity=".85"/>
    <path d="M72 170 Q100 190 128 170 Q100 178 72 170 Z" fill="#FF6B6B" ${S}/>
    <circle cx="100" cy="178" r="7" fill="#FFD45C" stroke="${INK}" stroke-width="2"/>
    <path d="M96 178 q4 -3 8 0" stroke="${INK}" stroke-width="1.5" fill="none"/>
    ${paws("#FFF8E7", 66, 134, 186)}
    ${m === "sleepy" ? `
      <g transform="translate(142, 38)">
        <text x="0" y="24" font-size="34" font-family="Baloo 2, sans-serif" font-weight="800" fill="#FFD45C" stroke="${INK}" stroke-width="6" paint-order="stroke fill">z</text>
        <text x="18" y="10" font-size="26" font-family="Baloo 2, sans-serif" font-weight="800" fill="#FFE58F" stroke="${INK}" stroke-width="5" paint-order="stroke fill">z</text>
      </g>` : ""}
  `,

  owl: (m, prop = "") => `
    <path d="M48 64 L36 30 L60 46 L70 36 L72 58 Z" fill="#9E6B3E" ${S}/>
    <path d="M152 64 L164 30 L140 46 L130 36 L128 58 Z" fill="#9E6B3E" ${S}/>
    <ellipse cx="100" cy="120" rx="76" ry="72" fill="url(#ch_owlBody)" ${S}/>
    <path d="M60 114 C60 162 80 176 100 176 C120 176 140 162 140 114 C140 98 120 94 100 94 C80 94 60 98 60 114 Z" fill="url(#ch_owlBelly)"/>
    <g stroke="#BC8654" stroke-width="3.5" fill="none" stroke-linecap="round">
      <path d="M84 126 q8 6 16 0 q8 6 16 0"/>
      <path d="M80 142 q10 7 20 0 q10 7 20 0"/>
      <path d="M86 158 q7 5 14 0 q7 5 14 0"/>
    </g>
    <g class="spectacles">
      <circle cx="70" cy="100" r="28" fill="url(#ch_lensGlass)" stroke="#D4973B" stroke-width="6"/>
      <circle cx="130" cy="100" r="28" fill="url(#ch_lensGlass)" stroke="#D4973B" stroke-width="6"/>
      <circle cx="70" cy="100" r="28" fill="none" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="130" cy="100" r="28" fill="none" stroke="${INK}" stroke-width="2.5"/>
      <path d="M96 98 Q100 93 104 98" stroke="#D4973B" stroke-width="6" fill="none"/>
      <path d="M96 98 Q100 93 104 98" stroke="${INK}" stroke-width="2.5" fill="none"/>
      <path d="M54 88 L74 76" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".9"/>
      <path d="M114 88 L134 76" stroke="#FFFFFF" stroke-width="4" stroke-linecap="round" opacity=".9"/>
    </g>
    ${eyes(m === "talk" ? "normal" : m, 70, 130, 100, 8.5)}
    <path d="M91 116 L100 134 L109 116 Q100 113 91 116 Z" fill="#FFA526" ${S}/>
    <path d="M93 118 Q100 126 107 118" stroke="#D97A06" stroke-width="2.5" fill="none"/>
    ${m === "talk" ? `<path d="M94 137 q6 8 12 0" stroke="${INK}" stroke-width="3.5" fill="none"/>` : ""}
    ${m === "surprise" ? `<ellipse cx="100" cy="142" rx="6" ry="8" fill="${INK}"/>` : ""}
    <g transform="translate(100, 172)">
      <polygon points="-12,-6 -12,6 0,0" fill="#FF5E5E" stroke="${INK}" stroke-width="2.5"/>
      <polygon points="12,-6 12,6 0,0" fill="#FF5E5E" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="0" cy="0" r="4.5" fill="#D93838" stroke="${INK}" stroke-width="2"/>
    </g>
    ${paws("#F2DEC5", 68, 132, 186)}
    ${m === "think" ? `<text x="156" y="52" font-size="44" font-family="Baloo 2, sans-serif" font-weight="800" fill="#8EC5FF" stroke="${INK}" stroke-width="7" paint-order="stroke fill">?</text>` : ""}
    ${prop.includes("magnifier") ? `
      <g transform="translate(144, 114) rotate(16)">
        <path d="M-6 32 L16 62" stroke="#8A4E1B" stroke-width="12" stroke-linecap="round"/>
        <path d="M-6 32 L16 62" stroke="#DDA86E" stroke-width="4" stroke-linecap="round" opacity=".5"/>
        <circle cx="0" cy="12" r="26" fill="url(#ch_lensGlass)" stroke="#D4973B" stroke-width="7"/>
        <circle cx="0" cy="12" r="26" fill="none" stroke="${INK}" stroke-width="3"/>
        <path d="M-12 2 L10 -16" stroke="#FFFFFF" stroke-width="4.5" stroke-linecap="round" opacity=".8"/>
        <ellipse cx="6" cy="40" rx="11" ry="8" fill="#9E6B3E" stroke="${INK}" stroke-width="3.5"/>
      </g>` : ""}
  `,

  mouse: (m, prop = "") => `
    <g class="ears">
      <circle cx="42" cy="62" r="36" fill="url(#ch_mouseFur)" ${S}/>
      <circle cx="42" cy="62" r="24" fill="url(#ch_mouseEar)"/>
      <path d="M30 52 A 16 16 0 0 1 54 52" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" fill="none" opacity=".6"/>
      <circle cx="158" cy="62" r="36" fill="url(#ch_mouseFur)" ${S}/>
      <circle cx="158" cy="62" r="24" fill="url(#ch_mouseEar)"/>
      <path d="M146 52 A 16 16 0 0 1 170 52" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" fill="none" opacity=".6"/>
    </g>
    <ellipse cx="100" cy="126" rx="72" ry="64" fill="url(#ch_mouseFur)" ${S}/>
    ${eyes(m, 72, 128, 114, 7)}
    <path d="M94 125 C94 120 106 120 106 125 C106 130 101 133 100 133 C99 133 94 130 94 125 Z" fill="#FF7597" stroke="${INK}" stroke-width="2"/>
    ${mouth(m, 100, 140)}
    ${blush(56, 144, 134)}
    <g stroke="${INK}" stroke-width="3" stroke-linecap="round" fill="none">
      <path d="M46 126 C30 124 18 128 12 134"/>
      <path d="M46 136 C32 140 22 148 16 156"/>
      <path d="M154 126 C170 124 182 128 188 134"/>
      <path d="M154 136 C168 140 178 148 184 156"/>
    </g>
    ${paws("#FAF5FC", 66, 134, 186)}
    <g transform="translate(136, 120) rotate(8)">
      <path d="M22 -16 L28 42" stroke="#FF6B6B" stroke-width="7" stroke-linecap="round"/>
      <path d="M20 -10 L26 -14 M22 0 L27 -4 M24 10 L29 6" stroke="#FFFFFF" stroke-width="2.5"/>
      <path d="M6 8 L10 52 Q24 58 38 52 L42 8 Z" fill="url(#ch_teaGrad)" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>
      <ellipse cx="24" cy="8" rx="20" ry="6" fill="#FFFFFF" stroke="${INK}" stroke-width="3.5"/>
      <circle cx="16" cy="46" r="4.2" fill="${INK}"/>
      <circle cx="24" cy="48" r="4.2" fill="${INK}"/>
      <circle cx="32" cy="45" r="4.2" fill="${INK}"/>
      <circle cx="20" cy="39" r="3.8" fill="${INK}"/>
      <circle cx="28" cy="38" r="3.8" fill="${INK}"/>
      <circle cx="15" cy="44.5" r="1.2" fill="#FFFFFF"/>
      <circle cx="23" cy="46.5" r="1.2" fill="#FFFFFF"/>
      <circle cx="31" cy="43.5" r="1.2" fill="#FFFFFF"/>
      <ellipse cx="6" cy="28" rx="7" ry="5.5" fill="#FAF5FC" stroke="${INK}" stroke-width="2.5"/>
      <ellipse cx="42" cy="30" rx="7" ry="5.5" fill="#FAF5FC" stroke="${INK}" stroke-width="2.5"/>
    </g>
    ${m === "angry" ? `<text x="156" y="44" font-size="40" font-family="Baloo 2, sans-serif" font-weight="800" fill="#FF5E5E" stroke="${INK}" stroke-width="6" paint-order="stroke fill">!</text>` : ""}
  `,

  raccoon: (m, prop = "") => `
    <g class="tail">
      <path d="M142 164 C175 160 196 138 190 98 C186 78 164 74 150 86" stroke="${INK}" stroke-width="28" stroke-linecap="round" fill="none"/>
      <path d="M142 164 C175 160 196 138 190 98 C186 78 164 74 150 86" stroke="#484854" stroke-width="22" stroke-linecap="round" stroke-dasharray="16 16" fill="none"/>
      <path d="M152 86 q-6 -8 2 -12" stroke="#D6D6DE" stroke-width="4" fill="none"/>
    </g>
    <polygon points="44,72 32,28 72,50" fill="#7E7E8E" ${S}/>
    <polygon points="46,64 38,36 64,50" fill="#ECECF2"/>
    <polygon points="156,72 168,28 128,50" fill="#7E7E8E" ${S}/>
    <polygon points="154,64 162,36 136,50" fill="#ECECF2"/>
    <path d="M36 100 C30 114 26 130 36 136 C42 140 44 148 48 152 C60 168 80 174 100 174 C120 174 140 168 152 152 C156 148 158 140 164 136 C174 130 170 114 164 100 C154 68 134 58 100 58 C66 58 46 68 36 100 Z" fill="url(#ch_raccoonFur)" ${S}/>
    <path d="M32 108 C54 88 84 96 100 102 C116 96 146 88 168 108 C152 134 118 124 100 126 C82 124 48 134 32 108 Z" fill="#3E3A42" stroke="${INK}" stroke-width="2"/>
    <path d="M96 58 L104 58 L102 88 L98 88 Z" fill="#3E3A42" opacity=".8"/>
    <path d="M72 136 C72 124 84 120 100 120 C116 120 128 124 128 136 C128 154 116 164 100 164 C84 164 72 154 72 136 Z" fill="#FFFFFF"/>
    <ellipse cx="100" cy="132" rx="9" ry="6.5" fill="${INK}"/>
    <circle cx="97" cy="130" r="2" fill="#FFFFFF"/>
    ${eyes(m, 68, 132, 108, 7.5, true)}
    ${mouth(m, 100, 146)}
    ${m === "smirk" ? `<polygon points="106,146 110,146 108,152" fill="#FFFFFF" stroke="${INK}" stroke-width="1.5"/>` : ""}
    ${paws("#B8B8C4", 66, 134, 186)}
  `,

  box: m => `
    <path d="M30 90 l20 -30 h100 l20 30z" fill="#E7B97F" ${S}/>
    <rect x="30" y="90" width="140" height="100" fill="#D9A465" ${S}/>
    <path d="M30 90 l-14 30 M170 90 l14 30" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <g transform="translate(70 60)">
      <ellipse cx="30" cy="30" rx="34" ry="22" fill="#5C5560" ${S}/>
      <circle cx="18" cy="28" r="6" fill="#fff"/><circle cx="42" cy="28" r="6" fill="#fff"/>
      <circle cx="18" cy="28" r="3" fill="${INK}"/><circle cx="42" cy="28" r="3" fill="${INK}"/>
    </g>
    <rect x="30" y="90" width="140" height="100" fill="#D9A465" ${S}/>
    <path d="M70 130 h60" stroke="#B9844A" stroke-width="5" stroke-linecap="round"/>
    <text x="140" y="56" font-size="40" font-family="Baloo 2, sans-serif" font-weight="800" fill="#FF8A7A" stroke="${INK}" stroke-width="6" paint-order="stroke fill">?!</text>
  `,

  dogbox: m => `
    <g transform="translate(20 -8) scale(.8)">${CH.dog(m)}</g>
    <rect x="20" y="118" width="160" height="78" fill="#D9A465" ${S}/>
    <path d="M20 118 l-18 -22 M180 118 l18 -22" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
    <path d="M70 156 h60" stroke="#B9844A" stroke-width="5" stroke-linecap="round"/>
  `
};

const AN = {
  dog: { e: [68, 132, 110], t: [100, 58] },
  owl: { e: [70, 130, 100], t: [100, 50] },
  mouse: { e: [72, 128, 114], t: [100, 60] },
  raccoon: { e: [68, 132, 108], t: [100, 58] }
};

// Eye accessories share the line between both eyes, including tilted bitmap poses.
function eyeAttachment(e) {
  const [lx, ly, rx, ry] = e.length === 4 ? e : [e[0], e[2], e[1], e[2]];
  return { x: (lx + rx) / 2, y: (ly + ry) / 2,
    span: Math.hypot(rx - lx, ry - ly), angle: Math.atan2(ry - ly, rx - lx) * 180 / Math.PI };
}
function onEyes(e, render) {
  const a = eyeAttachment(e);
  return `<g transform="translate(${a.x} ${a.y}) rotate(${a.angle})">${render(a.span)}</g>`;
}

const PROP = {
  sunglasses: e => onEyes(e, span => {
    const l = -span / 2, r = span / 2, half = Math.min(22, span * .4);
    return `<g class="prop-sunglasses">
      ${[l, r].map(x => `<rect x="${x-half}" y="-14" width="${half*2}" height="28" rx="10" fill="#22222E" ${S}/><path d="M${x-half+7} -5 l10 -5" stroke="#8EC5FF" stroke-width="3" stroke-linecap="round"/>`).join("")}
      <path d="M${l+half} -3 H${r-half}" stroke="${INK}" stroke-width="5"/>
    </g>`;
  }),
  eyemask: e => onEyes(e, span => {
    const half = span / 2 + 20;
    return `<g class="prop-eyemask">
      <path d="M${-half-14} 0 H${half+14}" stroke="#7A6BD0" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M${-half} -16 Q${-span/2} -24 0 -12 Q${span/2} -24 ${half} -16
        L${half} 10 Q${span/2} 28 10 12 Q0 4 -10 12 Q${-span/2} 28 ${-half} 10 Z" fill="#BCAEFF" ${S}/>
      <path d="M${-span/2-7} 0 q7 6 14 0 M${span/2-7} 0 q7 6 14 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    </g>`;
  }),
  partyhat: (e, [x, y]) => `
    <g class="prop-partyhat">
      <path d="M${x-24} ${y+6} L${x} ${y-58} L${x+24} ${y+6} Z" fill="#FF7B7B" ${S}/>
      <path d="M${x-16} ${y-18} l12 6 M${x-8} ${y-38} l10 5" stroke="#FFE58F" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="${x}" cy="${y-58}" r="8" fill="#FFD45C" stroke="${INK}" stroke-width="3"/>
    </g>
  `,
  scarf: (e, t, { neck = [100, 174, 116] } = {}) => `
    <g class="prop-scarf" transform="translate(${neck[0]} ${neck[1]}) scale(${neck[2]/116}) translate(-100 -174)">
      <path d="M42 168 Q100 192 158 168 L160 184 Q100 206 40 184 Z" fill="#FF6B6B" ${S}/>
      <path d="M128 178 l12 24 l18 -4 l-8 -24 z" fill="#E85050" ${S}/>
      <path d="M136 204 v4 M144 203 v4 M152 201 v4" stroke="#FFF" stroke-width="2.5" stroke-linecap="round"/>
    </g>
  `,
  magnifier: () => "", // handled within owl
  sweat: e => { const { x, y, span } = eyeAttachment(e); const r = x + span / 2; return `
    <g transform="translate(${r+26}, ${y-30})">
      <path d="M8 0 C16 12 18 20 10 24 C2 28 -4 20 2 12 Z" fill="#8EC5FF" ${S}/>
      <ellipse cx="6" cy="18" rx="2" ry="4" fill="#FFFFFF" opacity=".7"/>
    </g>
  `; }
};

// Versioned bitmap atlas: reuse these exact pixels in every issue.
const activeCharacterPack = typeof CHARACTER_PACK === "undefined" ? null : CHARACTER_PACK;
const characterPackReady = activeCharacterPack ? (() => {
  document.body.insertAdjacentHTML("afterbegin", `<svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs>${Object.entries(activeCharacterPack.atlases).map(([key, atlas]) => `<image id="kids-character-${key}" width="${atlas.width}" height="${atlas.height}" href="${activeCharacterPack.images[key]}"/>`).join("")}</defs></svg>`);
  return Promise.all(Object.values(activeCharacterPack.images).map(src => { const image = new Image(); image.src = src; return image.decode(); }));
})() : Promise.resolve();

function drawBitmap(name, mood, size, props) {
  const role = name === "box" ? "raccoon" : name === "dogbox" ? "dog" : name;
  const character = activeCharacterPack.characters[role];
  const expression = mood === "peek" ? "smirk" : mood;
  const frame = character?.frames[expression];
  if (!frame) throw new Error(`角色素材库缺少 ${role}:${expression}`);
  const boxed = name === "box" || name === "dogbox";
  const portrait = `<svg x="${boxed ? 35 : 0}" y="0" width="${boxed ? 130 : 200}" height="${boxed ? 130 : 200}" viewBox="${frame.join(" ")}" overflow="hidden"><use href="#kids-character-${character.atlas}"/></svg>`;
  const cardboard = boxed ? `<rect x="20" y="112" width="160" height="82" fill="#D9A465" ${S}/><path d="M20 112 l-16 -20 M180 112 l16 -20 M74 154 h52" fill="none" ${S}/>` : "";
  const anchors = character.attachments?.[expression] || { eyes: character.eyes, top: character.top };
  const accessories = boxed ? "" : props.split("+").filter(Boolean).map(prop => {
    if (prop === "magnifier") return `<path d="M150 152 l30 30" stroke="#8A5A2B" stroke-width="12" stroke-linecap="round"/><circle cx="138" cy="140" r="24" fill="#DFF3FF" fill-opacity=".55" ${S}/>`;
    return PROP[prop] ? PROP[prop](anchors.eyes, anchors.top, anchors) : "";
  }).join("");
  return `<svg class="ch" data-character-pack="${activeCharacterPack.id}" data-character="${role}" data-expression="${expression}" width="${size}" height="${size}" viewBox="0 0 200 200" overflow="visible">${portrait}${cardboard}${accessories}</svg>`;
}

function draw(name, mood, size, props = "") {
  if (activeCharacterPack) return drawBitmap(name, mood, size, props);
  const a = AN[name];
  const extra = props.split("+").filter(Boolean).map(k => PROP[k] && a ? PROP[k](a.e, a.t) : "").join("");
  const content = CH[name] ? CH[name](mood, props) : "";
  return `<svg class="ch" width="${size}" height="${size}" viewBox="0 0 200 200" overflow="visible">${CH_DEFS}${content}${extra}</svg>`;
}
