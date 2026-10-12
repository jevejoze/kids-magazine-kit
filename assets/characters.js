// 角色 SVG：draw(name, mood, size)
const INK="#4A3B32";
function eyes(m,lx,rx,y,r){
  if(m==="happy"||m==="wave"||m==="smirk")return `<path d="M${lx-9} ${y+3} q9 -12 18 0 M${rx-9} ${y+3} q9 -12 18 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  if(m==="sleepy")return `<path d="M${lx-9} ${y} q9 8 18 0 M${rx-9} ${y} q9 8 18 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  if(m==="angry")return `<circle cx="${lx}" cy="${y+2}" r="${r}" fill="${INK}"/><circle cx="${rx}" cy="${y+2}" r="${r}" fill="${INK}"/><path d="M${lx-12} ${y-14} l20 8 M${rx+12} ${y-14} l-20 8" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  const rr=m==="surprise"?r+2:r;
  return `<circle cx="${lx}" cy="${y}" r="${rr}" fill="${INK}"/><circle cx="${rx}" cy="${y}" r="${rr}" fill="${INK}"/><circle cx="${lx+2}" cy="${y-3}" r="2.5" fill="#fff"/><circle cx="${rx+2}" cy="${y-3}" r="2.5" fill="#fff"/>`;
}
function mouth(m,x,y){
  if(m==="surprise")return `<ellipse cx="${x}" cy="${y+6}" rx="8" ry="10" fill="${INK}"/>`;
  if(m==="angry")return `<path d="M${x-10} ${y+8} q10 -8 20 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  if(m==="talk")return `<path d="M${x-12} ${y} q12 18 24 0 z" fill="#E86A6A" stroke="${INK}" stroke-width="4"/>`;
  if(m==="think")return `<path d="M${x-8} ${y+4} h16" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
  if(m==="smirk")return `<path d="M${x-12} ${y+2} q14 12 24 -6" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  return `<path d="M${x-12} ${y} q6 8 12 0 q6 8 12 0" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
}
const blush=(a,b,y)=>`<ellipse cx="${a}" cy="${y}" rx="13" ry="8" fill="#FF9DAE" opacity=".8"/><ellipse cx="${b}" cy="${y}" rx="13" ry="8" fill="#FF9DAE" opacity=".8"/>`;
const S=`stroke="${INK}" stroke-width="5" stroke-linejoin="round"`;

const CH={
 dog:m=>`
  <ellipse cx="100" cy="122" rx="78" ry="66" fill="#FFEFD2" ${S}/>
  <path d="M34 82 q-26 10 -18 56 q22 4 30 -20z" fill="#D9A06B" ${S}/>
  <path d="M166 82 q26 10 18 56 q-22 4 -30 -20z" fill="#D9A06B" ${S}/>
  <ellipse cx="100" cy="132" rx="22" ry="15" fill="#fff"/>
  <ellipse cx="100" cy="124" rx="9" ry="6.5" fill="${INK}"/>
  ${eyes(m,70,130,108,7)}${mouth(m,100,136)}${blush(55,145,132)}
  ${m==="sleepy"?`<text x="150" y="60" font-size="34" font-family="Baloo 2" fill="${INK}">z z</text>`:""}`,
 mouse:m=>`
  <circle cx="44" cy="62" r="34" fill="#E9DFF0" ${S}/><circle cx="44" cy="62" r="18" fill="#FFC2D1"/>
  <circle cx="156" cy="62" r="34" fill="#E9DFF0" ${S}/><circle cx="156" cy="62" r="18" fill="#FFC2D1"/>
  <ellipse cx="100" cy="124" rx="70" ry="62" fill="#F4EEF8" ${S}/>
  ${eyes(m,76,124,114,7)}
  <ellipse cx="100" cy="132" rx="7" ry="5" fill="#FF8FA8" stroke="${INK}" stroke-width="3"/>
  ${mouth(m,100,142)}${blush(60,140,136)}
  <path d="M44 128 h-26 M46 138 l-24 6 M156 128 h26 M154 138 l24 6" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
  <g transform="translate(${m==="wave"?150:138} 136) rotate(${m==="wave"?12:0})">
    <path d="M0 0 h40 l-5 52 h-30z" fill="#F2D7B5" ${S}/><path d="M2 14 h36" stroke="${INK}" stroke-width="3"/>
    <circle cx="12" cy="40" r="4" fill="${INK}"/><circle cx="24" cy="44" r="4" fill="${INK}"/><circle cx="20" cy="33" r="4" fill="${INK}"/>
    <path d="M24 0 l8 -26" stroke="#FF8A7A" stroke-width="7" stroke-linecap="round"/></g>
  ${m==="angry"?`<text x="152" y="34" font-size="40" fill="#FF6A6A">!</text>`:""}`,
 owl:m=>`
  <path d="M40 60 l-6 -30 l30 16z M160 60 l6 -30 l-30 16z" fill="#B88A5E" ${S}/>
  <ellipse cx="100" cy="120" rx="74" ry="72" fill="#C99B6D" ${S}/>
  <ellipse cx="100" cy="146" rx="46" ry="40" fill="#F3DEC0"/>
  <path d="M84 158 q8 6 16 0 q8 6 16 0 M84 172 q8 6 16 0 q8 6 16 0" stroke="#C99B6D" stroke-width="3" fill="none"/>
  <circle cx="72" cy="100" r="26" fill="#fff" ${S}/><circle cx="128" cy="100" r="26" fill="#fff" ${S}/>
  <path d="M98 100 h4" stroke="${INK}" stroke-width="5"/>
  ${eyes(m==="talk"?"normal":m,72,128,100,8)}
  <path d="M92 122 l8 14 l8 -14z" fill="#FFB347" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
  ${m==="talk"?`<path d="M94 138 q6 6 12 0" stroke="${INK}" stroke-width="3" fill="none"/>`:""}
  ${m==="think"?`<text x="160" y="50" font-size="44" font-family="Baloo 2" fill="${INK}">?</text>`:""}`,
 raccoon:m=>`
  <path d="M150 170 q50 -10 40 -70" stroke="${INK}" stroke-width="30" fill="none" stroke-linecap="round"/>
  <path d="M150 170 q50 -10 40 -70" stroke="#A7A7B5" stroke-width="20" fill="none" stroke-linecap="round" stroke-dasharray="14 12"/>
  <path d="M46 70 l-4 -40 l38 24z M154 70 l4 -40 l-38 24z" fill="#9C9CAA" ${S}/>
  <ellipse cx="100" cy="122" rx="74" ry="64" fill="#C4C4CF" ${S}/>
  <path d="M34 110 q30 -26 66 -6 q36 -20 66 6 q-30 24 -66 8 q-36 16 -66 -8z" fill="#5C5560"/>
  ${eyes(m,70,130,110,7).replaceAll(INK,"#fff")}
  <ellipse cx="100" cy="148" rx="30" ry="20" fill="#fff"/>
  <ellipse cx="100" cy="138" rx="8" ry="6" fill="${INK}"/>${mouth(m,100,150)}`,
 box:m=>`
  <path d="M30 90 l20 -30 h100 l20 30z" fill="#E7B97F" ${S}/>
  <rect x="30" y="90" width="140" height="100" fill="#D9A465" ${S}/>
  <path d="M30 90 l-14 30 M170 90 l14 30" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
  <g transform="translate(70 60)"><ellipse cx="30" cy="30" rx="34" ry="22" fill="#5C5560" ${S}/>
   <circle cx="18" cy="28" r="6" fill="#fff"/><circle cx="42" cy="28" r="6" fill="#fff"/></g>
  <rect x="30" y="90" width="140" height="100" fill="#D9A465" ${S}/>
  <path d="M70 130 h60" stroke="#B9844A" stroke-width="5" stroke-linecap="round"/>
  <text x="140" y="56" font-size="40" font-family="Baloo 2" fill="${INK}">?!</text>`,
 dogbox:m=>`
  <g transform="translate(20 -6) scale(.8)">${CH.dog(m)}</g>
  <rect x="20" y="118" width="160" height="78" fill="#D9A465" ${S}/>
  <path d="M20 118 l-18 -22 M180 118 l18 -22" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
  <path d="M70 156 h60" stroke="#B9844A" stroke-width="5" stroke-linecap="round"/>`
};
// 道具：按每个角色的眼睛位置和头顶位置画，写法 "dog:sleepy:150:eyemask+scarf"
const AN={dog:{e:[70,130,108],t:[100,58]},mouse:{e:[76,124,114],t:[100,64]},owl:{e:[72,128,100],t:[100,50]},raccoon:{e:[70,130,110],t:[100,60]}};
const PROP={
 sunglasses:([l,r,y])=>`<rect x="${l-24}" y="${y-15}" width="48" height="32" rx="12" fill="#2B2B3A" ${S}/><rect x="${r-24}" y="${y-15}" width="48" height="32" rx="12" fill="#2B2B3A" ${S}/>
  <path d="M${l+24} ${y-4} h${r-l-48}" stroke="${INK}" stroke-width="5"/><path d="M${l-14} ${y-6} l10 -4 M${r-14} ${y-6} l10 -4" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".7"/>`,
 eyemask:([l,r,y])=>`<path d="M20 ${y-40} q80 -14 160 0" stroke="#7A6BD0" stroke-width="7" fill="none"/>
  <path d="M${l-26} ${y-52} q${(r-l)/2+26} -10 ${r-l+52} 0 q4 26 -20 28 q-${(r-l)/2} -8 ${-(r-l)+12} 0 q-26 -2 -22 -28z" fill="#B9A8F5" ${S}/>
  <path d="M${l-8} ${y-36} q8 6 16 0 M${r-8} ${y-36} q8 6 16 0" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
 partyhat:(e,[x,y])=>`<path d="M${x-26} ${y+6} l26 -62 l26 62z" fill="#FF8A7A" ${S}/><circle cx="${x}" cy="${y-58}" r="9" fill="#FFD45C" ${S}/>
  <path d="M${x-14} ${y-22} l10 4 M${x+2} ${y-10} l10 4" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`,
 scarf:()=>`<path d="M40 176 q60 22 120 0 l2 18 q-62 22 -124 0z" fill="#FF8A7A" ${S}/><path d="M128 184 l10 16 l18 -4 l-6 -18z" fill="#FF8A7A" ${S}/>`,
 magnifier:()=>`<path d="M150 150 l30 30" stroke="#8A5A2B" stroke-width="12" stroke-linecap="round"/><circle cx="138" cy="138" r="24" fill="#DFF3FF" fill-opacity=".7" ${S}/>`,
 sweat:([l,r,y])=>`<path d="M${r+30} ${y-30} q8 14 0 20 q-8 -6 0 -20z" fill="#8EC5FF" stroke="${INK}" stroke-width="3"/>`
};
function draw(name,mood,size,props=""){
  const a=AN[name], extra=props.split("+").filter(Boolean).map(k=>PROP[k]?PROP[k](a.e,a.t):"").join("");
  return `<svg class="ch" width="${size}" height="${size}" viewBox="0 0 200 200" overflow="visible">${CH[name](mood)}${a?extra:""}</svg>`}
