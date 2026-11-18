// The Devpost thumbnail (3:2, 1500x1000): a dim room with a huge window full of blue sky and
// clouds (Dreamlive's own sky photo), "DREAM / LIVE" across it in bold white-and-blue brush
// lettering, a glowing figure seen from behind on a sofa facing it, and a floor lamp.
//   node scripts/trailer/thumbnail.cjs OUT.png
const path = require('path');
const sharp = require(path.join(__dirname, '..', '..', 'node_modules', 'sharp'));

const W = 1500;
const H = 1000;
const WIN = { x: 230, y: 90, w: 1040, h: 560 };
const font = "'Ink Free', 'Segoe Print', 'Impact', sans-serif";
const word = (text, x, y, rot, size) => `
  <g transform="translate(${x} ${y}) rotate(${rot})">
    <text x="10" y="14" font-family="${font}" font-weight="900" font-size="${size}" fill="#1c6fc2" stroke="#1c6fc2" stroke-width="${size * 0.11}" stroke-linejoin="round" text-anchor="middle" letter-spacing="${size * 0.04}">${text}</text>
    <text x="0" y="0" font-family="${font}" font-weight="900" font-size="${size}" fill="#ffffff" stroke="#ffffff" stroke-width="${size * 0.08}" stroke-linejoin="round" text-anchor="middle" letter-spacing="${size * 0.04}">${text}</text>
    <text x="0" y="0" font-family="${font}" font-weight="900" font-size="${size}" fill="url(#ice)" text-anchor="middle" letter-spacing="${size * 0.04}">${text}</text>
  </g>`;

// Bigfoot from behind, sitting: a big shaggy head on broad sloping shoulders (fur edge from a
// displacement filter), glowing blue like a dream.
const bigfoot = `
  <g filter="url(#fur)" fill="url(#fig)">
    <!-- head and neck -->
    <ellipse cx="750" cy="628" rx="54" ry="66"/>
    <path d="M 724 680 L 776 680 L 782 742 L 718 742 Z"/>
    <!-- shoulders and back, arms resting at the sides -->
    <path d="M 750 728 C 690 728 640 734 612 752 C 584 770 570 800 566 840
             C 562 880 560 940 558 1000 L 942 1000 C 940 940 938 880 934 840
             C 930 800 916 770 888 752 C 860 734 810 728 750 728 Z"/>
    <path d="M 566 800 C 548 830 540 880 538 1000 L 584 1000 C 584 900 586 850 596 812 Z"/>
    <path d="M 934 800 C 952 830 960 880 962 1000 L 916 1000 C 916 900 914 850 904 812 Z"/>
  </g>`;

const svg = (sky) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">
  <defs>
    <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3a3d44"/><stop offset="1" stop-color="#202228"/>
    </linearGradient>
    <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2a2420"/><stop offset="1" stop-color="#14110f"/>
    </linearGradient>
    <linearGradient id="ice" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#bfe6ff"/>
    </linearGradient>
    <radialGradient id="fig" gradientUnits="userSpaceOnUse" cx="750" cy="700" r="380">
      <stop offset="0" stop-color="#9fe3ff"/><stop offset="0.55" stop-color="#2f9be6"/><stop offset="1" stop-color="#0d4f9a"/>
    </radialGradient>
    <radialGradient id="spill" cx="50%" cy="0%" r="90%">
      <stop offset="0" stop-color="#cfe9ff" stop-opacity="0.35"/><stop offset="1" stop-color="#cfe9ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="lamp" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#ffe2a8" stop-opacity="0.75"/><stop offset="1" stop-color="#ffe2a8" stop-opacity="0"/>
    </radialGradient>
    <filter id="fur" x="-20%" y="-20%" width="140%" height="140%">
      <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves="2" seed="7" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G" result="d"/>
      <feGaussianBlur in="d" stdDeviation="16" result="g"/>
      <feColorMatrix in="g" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.8  0 0 0 0 1  0 0 0 0.9 0" result="glow"/>
      <feMerge><feMergeNode in="glow"/><feMergeNode in="d"/></feMerge>
    </filter>
    <filter id="soft"><feGaussianBlur stdDeviation="3"/></filter>
    <clipPath id="win"><rect x="${WIN.x}" y="${WIN.y}" width="${WIN.w}" height="${WIN.h}"/></clipPath>
  </defs>
  <!-- The room -->
  <rect width="${W}" height="${H}" fill="url(#wall)"/>
  <polygon points="0,0 ${WIN.x - 90},40 ${WIN.x - 90},720 0,${H}" fill="#191b20"/>
  <polygon points="${W},0 ${WIN.x + WIN.w + 90},40 ${WIN.x + WIN.w + 90},720 ${W},${H}" fill="#191b20"/>
  <polygon points="0,${H} ${WIN.x - 90},720 ${WIN.x + WIN.w + 90},720 ${W},${H}" fill="url(#floor)"/>
  <!-- The big window: the sky -->
  <image x="${WIN.x}" y="${WIN.y}" width="${WIN.w}" height="${WIN.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#win)" xlink:href="data:image/jpeg;base64,${sky}"/>
  <rect x="${WIN.x}" y="${WIN.y}" width="${WIN.w}" height="${WIN.h}" fill="none" stroke="#0e0f12" stroke-width="22"/>
  <rect x="${WIN.x - 30}" y="${WIN.y + WIN.h + 6}" width="${WIN.w + 60}" height="26" fill="#121316"/>
  <!-- Its light on the floor -->
  <polygon points="${WIN.x},720 ${WIN.x + WIN.w},720 ${W - 60},${H} 60,${H}" fill="url(#spill)"/>
  <!-- A floor lamp, right -->
  <circle cx="1355" cy="430" r="150" fill="url(#lamp)"/>
  <rect x="1352" y="440" width="7" height="400" fill="#0c0c0e"/>
  <ellipse cx="1355" cy="842" rx="44" ry="10" fill="#0c0c0e"/>
  <circle cx="1355" cy="425" r="34" fill="#fff2d6"/>
  <!-- The title across the sky -->
  ${word('DREAM', W / 2, 305, -5, 210)}
  ${word('LIVE', W / 2 + 30, 505, -5, 210)}
  <!-- The sofa back and Bigfoot sitting on it, from behind -->
  ${bigfoot}
  <path d="M 380 1000 L 400 868 Q 405 850 430 848 L 1070 848 Q 1095 850 1100 868 L 1120 1000 Z" fill="#141518"/>
  <rect x="380" y="860" width="740" height="10" fill="#26282e" filter="url(#soft)"/>
</svg>`;

(async () => {
  // The sky photo (Poly Haven CC0, as tone-mapped for the garden): the upper part with the clouds.
  const skyPath = path.join(__dirname, '..', '..', 'public', 'env', 'sky', 'day.webp');
  const sky = await sharp(skyPath).extract({ left: 200, top: 40, width: 1500, height: 560 }).modulate({ brightness: 1.12, saturation: 1.15 }).jpeg({ quality: 92 }).toBuffer();
  const info = await sharp(Buffer.from(svg(sky.toString('base64')))).png().toFile(process.argv[2]);
  console.log('ok', info.width, info.height);
})();
