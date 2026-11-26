/* Brain Bank avatar builder: code "b#f#s#c#a#" -> SVG character */
(() => {
  const BODIES = ['Round', 'Tall', 'Robot', 'Blob', 'Cat', 'Alien', 'Bear'];
  const FACES = ['Happy', 'Cool', 'Nerd', 'Wink', 'Star-eyed', 'Surprised', 'Sleepy', 'Silly'];
  const SHOES = ['Sneakers', 'Boots', 'Rockets', 'Skates', 'Slippers', 'Hero boots'];
  const COLORS = [['Teal', '#2fa38e'], ['Sky', '#3b9be0'], ['Purple', '#8b5cf6'], ['Pink', '#ec6fae'], ['Red', '#e5484d'], ['Orange', '#f39c32'], ['Yellow', '#f5c518'], ['Green', '#4cbb4c'], ['Brown', '#a0714f'], ['Gray', '#8a94a6']];
  const AURAS = ['None', 'Glow', 'Sparkle', 'Fire', 'Rainbow', 'Electric'];
  const PARTS = [['b', 'Body', '🧍', BODIES], ['f', 'Face', '😀', FACES], ['s', 'Shoes', '👟', SHOES], ['c', 'Color', '🎨', COLORS.map(c => c[0])], ['a', 'Aura', '✨', AURAS]];
  const RE = /^b(\d{1,2})f(\d{1,2})s(\d{1,2})c(\d{1,2})a(\d{1,2})$/;
  const valid = c => RE.test(String(c || ''));
  const decode = c => { const m = RE.exec(String(c || '')) || [0, 0, 0, 0, 0, 0]; const o = {}; PARTS.forEach(([k, , , list], i) => o[k] = Math.min(+m[i + 1] || 0, list.length - 1)); return o; };
  const encode = o => PARTS.map(([k]) => k + (o[k] || 0)).join('');
  const random = () => encode(Object.fromEntries(PARTS.map(([k, , , list]) => [k, Math.random() * list.length | 0])));
  const shade = (hex, f) => '#' + [1, 3, 5].map(i => Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f))).toString(16).padStart(2, '0')).join('');
  const star = (x, y, r, k = 0.45) => Array.from({ length: 10 }, (_, i) => { const a = Math.PI / 5 * i - Math.PI / 2, d = i % 2 ? r * k : r; return (x + d * Math.cos(a)).toFixed(1) + ',' + (y + d * Math.sin(a)).toFixed(1); }).join(' ');
  const bolt = (x, y, s) => `<path d="M${x} ${y - 7 * s} l${-4 * s} ${8 * s} h${4 * s} l${-2 * s} ${7 * s} l${6 * s} ${-9 * s} h${-4 * s} z" fill="#7df9ff" stroke="#1a8fd6" stroke-width="1"/>`;

  function aura(i, id) {
    switch (i) {
      case 1: return `<defs><radialGradient id="${id}"><stop offset="45%" stop-color="#fff3a8"/><stop offset="100%" stop-color="#ffd23f" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="52" r="49" fill="url(#${id})"/>`;
      case 2: return `<circle cx="50" cy="52" r="44" fill="#fff6c9" opacity=".7"/>` + [[14, 22, 7], [86, 20, 6], [10, 66, 5], [90, 62, 7], [26, 8, 4], [76, 90, 4], [22, 92, 5]].map(([x, y, r]) => `<polygon points="${star(x, y, r)}" fill="#ffd23f" stroke="#e0a800" stroke-width=".8"/>`).join('');
      case 3: return `<path d="M50 1 C60 16 76 12 73 31 C88 27 94 48 85 62 C97 74 88 97 50 97 C12 97 3 74 15 62 C6 48 12 27 27 31 C24 12 40 16 50 1Z" fill="#ff6a1a"/><path d="M50 13 C58 25 70 22 67 37 C80 36 82 52 76 62 C84 72 76 90 50 90 C24 90 16 72 24 62 C18 52 20 36 33 37 C30 22 42 25 50 13Z" fill="#ffc21a"/>`;
      case 4: return ['#e5484d', '#f39c32', '#f5c518', '#4cbb4c', '#3b9be0', '#8b5cf6'].map((c, k) => `<circle cx="50" cy="52" r="${47 - k * 3}" fill="none" stroke="${c}" stroke-width="3" opacity=".85"/>`).join('');
      case 5: return `<circle cx="50" cy="52" r="45" fill="#dff9ff" opacity=".6"/><circle cx="50" cy="52" r="45" fill="none" stroke="#3ad1ff" stroke-width="2.5" stroke-dasharray="6 5"/>` + bolt(12, 30, 1.2) + bolt(90, 34, 1.1) + bolt(14, 78, 1) + bolt(88, 80, 1.2);
      default: return '';
    }
  }
  function body(i, C, D) {
    const st = `fill="${C}" stroke="${D}" stroke-width="2.5" stroke-linejoin="round"`;
    switch (i) {
      case 1: return `<rect x="25" y="13" width="50" height="66" rx="22" ${st}/>`;
      case 2: return `<line x1="50" y1="21" x2="50" y2="10" stroke="${D}" stroke-width="3"/><circle cx="50" cy="9" r="4.5" fill="#f5c518" stroke="${D}" stroke-width="1.5"/><rect x="17" y="40" width="6" height="16" rx="2" fill="${D}"/><rect x="77" y="40" width="6" height="16" rx="2" fill="${D}"/><rect x="22" y="21" width="56" height="56" rx="9" ${st}/><rect x="30" y="68" width="40" height="4" rx="2" fill="${D}" opacity=".5"/>`;
      case 3: return `<path d="M50 17 C73 15 83 33 79 52 C77 71 67 81 50 79 C32 81 20 71 22 52 C17 33 29 19 50 17Z" ${st}/><ellipse cx="38" cy="28" rx="7" ry="4" fill="#fff" opacity=".35"/>`;
      case 4: return `<polygon points="25,38 29,13 46,27" ${st}/><polygon points="75,38 71,13 54,27" ${st}/><polygon points="29,32 31,20 39,27" fill="#ffb3c9"/><polygon points="71,32 69,20 61,27" fill="#ffb3c9"/><circle cx="50" cy="52" r="28" ${st}/><g stroke="${D}" stroke-width="1.5"><line x1="20" y1="55" x2="33" y2="56"/><line x1="21" y1="61" x2="33" y2="59"/><line x1="80" y1="55" x2="67" y2="56"/><line x1="79" y1="61" x2="67" y2="59"/></g>`;
      case 5: return `<line x1="38" y1="26" x2="30" y2="9" stroke="${D}" stroke-width="2.5"/><line x1="62" y1="26" x2="70" y2="9" stroke="${D}" stroke-width="2.5"/><circle cx="30" cy="8" r="4" fill="#b6ff5c" stroke="${D}" stroke-width="1.5"/><circle cx="70" cy="8" r="4" fill="#b6ff5c" stroke="${D}" stroke-width="1.5"/><ellipse cx="50" cy="49" rx="31" ry="28" ${st}/>`;
      case 6: return `<circle cx="27" cy="27" r="9" ${st}/><circle cx="73" cy="27" r="9" ${st}/><circle cx="27" cy="27" r="4.5" fill="${D}" opacity=".5"/><circle cx="73" cy="27" r="4.5" fill="${D}" opacity=".5"/><circle cx="50" cy="51" r="28" ${st}/><ellipse cx="50" cy="61" rx="12" ry="8" fill="#fff" opacity=".4"/>`;
      default: return `<circle cx="50" cy="50" r="29" ${st}/><ellipse cx="38" cy="33" rx="8" ry="5" fill="#fff" opacity=".35"/>`;
    }
  }
  function face(i) {
    const K = '#222', eye = (x, y = 46, r = 3.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${K}"/><circle cx="${x + 1.2}" cy="${y - 1.2}" r="${r / 3}" fill="#fff"/>`;
    const blush = `<circle cx="33" cy="55" r="4" fill="#ff7aa8" opacity=".45"/><circle cx="67" cy="55" r="4" fill="#ff7aa8" opacity=".45"/>`;
    const L = `stroke="${K}" stroke-width="2.8" stroke-linecap="round" fill="none"`;
    switch (i) {
      case 1: return `<rect x="32" y="40" width="15" height="10" rx="4" fill="#111"/><rect x="53" y="40" width="15" height="10" rx="4" fill="#111"/><line x1="46" y1="43" x2="54" y2="43" stroke="#111" stroke-width="2.5"/><line x1="35" y1="42" x2="40" y2="42" stroke="#fff" stroke-width="1.5" opacity=".7"/><path d="M42 60 Q53 64 60 56" ${L}/>`;
      case 2: return `<circle cx="40" cy="46" r="7.5" fill="#fff" fill-opacity=".45" stroke="#333" stroke-width="2.5"/><circle cx="60" cy="46" r="7.5" fill="#fff" fill-opacity=".45" stroke="#333" stroke-width="2.5"/><line x1="47.5" y1="46" x2="52.5" y2="46" stroke="#333" stroke-width="2.5"/>${eye(40, 46, 2.6)}${eye(60, 46, 2.6)}<path d="M41 58 Q50 65 59 58" ${L}/><rect x="47" y="60" width="6" height="4.5" rx="1" fill="#fff" stroke="${K}" stroke-width="1.2"/>`;
      case 3: return `${eye(41)}<path d="M55 46 Q59 41.5 63 46" ${L}/><path d="M39 55 Q50 69 61 55 Z" fill="${K}"/><path d="M45 61 Q50 66.5 55 61 Q50 59 45 61Z" fill="#ff6b8b"/>${blush}`;
      case 4: return `<polygon points="${star(41, 46, 7)}" fill="#ffd23f" stroke="#c98a00" stroke-width="1.2"/><polygon points="${star(59, 46, 7)}" fill="#ffd23f" stroke="#c98a00" stroke-width="1.2"/><ellipse cx="50" cy="60" rx="6" ry="5" fill="${K}"/><ellipse cx="50" cy="62" rx="3.5" ry="2" fill="#ff6b8b"/>${blush}`;
      case 5: return `<circle cx="40" cy="45" r="6.5" fill="#fff" stroke="${K}" stroke-width="1.5"/><circle cx="60" cy="45" r="6.5" fill="#fff" stroke="${K}" stroke-width="1.5"/>${eye(40, 45, 3)}${eye(60, 45, 3)}<ellipse cx="50" cy="61" rx="4" ry="5" fill="${K}"/><path d="M33 36 Q38 33 44 35 M56 35 Q62 33 67 36" ${L}/>`;
      case 6: return `<path d="M36 47 Q41 51 46 47 M54 47 Q59 51 64 47" ${L}/><path d="M46 59 Q50 61 54 59" ${L}/><path d="M68 24 h8 l-8 8 h8 M78 14 h5 l-5 5 h5" stroke="#5560a8" stroke-width="2" fill="none" stroke-linejoin="round"/>${blush}`;
      case 7: return `${eye(40, 45, 4.2)}${eye(60, 47, 2.6)}<path d="M38 56 Q50 64 62 56" ${L}/><path d="M50 59 Q50 70 55 70 Q60 70 58 60" fill="#ff6b8b" stroke="${K}" stroke-width="1.5"/>`;
      default: return `${eye(41)}${eye(59)}<path d="M40 57 Q50 66 60 57" ${L}/>${blush}`;
    }
  }
  function shoes(i, D) {
    const feet = [41.5, 58.5], legs = `<rect x="37.5" y="73" width="8" height="15" rx="3" fill="${D}"/><rect x="54.5" y="73" width="8" height="15" rx="3" fill="${D}"/>`;
    const each = f => feet.map(f).join('');
    switch (i) {
      case 1: return legs + each(x => `<rect x="${x - 6}" y="81" width="11" height="10" rx="2" fill="#7a4a24"/><rect x="${x - 7}" y="89" width="14" height="4" rx="2" fill="#4a2c14"/>`);
      case 2: return legs + each(x => `<path d="M${x - 4} 93 L${x} 100 L${x + 4} 93Z" fill="#ff8a1a"/><path d="M${x - 2} 93 L${x} 97 L${x + 2} 93Z" fill="#ffe14d"/><ellipse cx="${x}" cy="89" rx="7.5" ry="4.5" fill="#b8c0cc" stroke="#55606e" stroke-width="1.2"/><circle cx="${x}" cy="88" r="1.6" fill="#e5484d"/>`);
      case 3: return legs + each(x => `<ellipse cx="${x}" cy="88" rx="7.5" ry="4.5" fill="#8b5cf6" stroke="#4b2a9a" stroke-width="1.2"/><rect x="${x - 7}" y="91.5" width="14" height="2" fill="#555"/><circle cx="${x - 4.5}" cy="96" r="2.6" fill="#ffd23f" stroke="#555" stroke-width="1"/><circle cx="${x + 4.5}" cy="96" r="2.6" fill="#ffd23f" stroke="#555" stroke-width="1"/>`);
      case 4: return legs + each(x => `<ellipse cx="${x}" cy="90" rx="8.5" ry="5" fill="#ffb3d1" stroke="#e57aa6" stroke-width="1.2"/><circle cx="${x - 3}" cy="86.5" r="2.4" fill="#fff"/><circle cx="${x + 3}" cy="86.5" r="2.4" fill="#fff"/><circle cx="${x}" cy="89" r="1.2" fill="#e57aa6"/>`);
      case 5: return legs + each(x => `<rect x="${x - 6}" y="77" width="12" height="14" rx="3" fill="#e5484d" stroke="#a11d22" stroke-width="1.2"/><rect x="${x - 6.5}" y="77" width="13" height="4" rx="1.5" fill="#ffd23f"/><ellipse cx="${x + 1}" cy="91" rx="7.5" ry="3" fill="#a11d22"/>`);
      default: return legs + each(x => `<ellipse cx="${x}" cy="89" rx="8" ry="4.8" fill="#fff" stroke="#333" stroke-width="1.3"/><path d="M${x - 6} 90.5 h12" stroke="#e5484d" stroke-width="2"/><circle cx="${x - 1}" cy="86.5" r="1" fill="#333"/><circle cx="${x + 2}" cy="86.5" r="1" fill="#333"/>`);
    }
  }
  function svg(code, size) {
    const o = decode(code), C = COLORS[o.c][1], D = shade(C, 0.68), id = 'ag' + encode(o);
    const s = size ? ` width="${size}" height="${size}"` : '';
    return `<svg class="avsvg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"${s} role="img" aria-label="avatar">${aura(o.a, id)}${shoes(o.s, D)}${body(o.b, C, D)}${face(o.f)}</svg>`;
  }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const html = (code, size) => valid(code) ? svg(code, size) : `<span class="avemo">${esc(code || '🙂')}</span>`;
  const image = code => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(code, 400)); });
  window.Avatar = { PARTS, COLORS, valid, decode, encode, random, svg, html, image };
})();
