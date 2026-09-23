const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function createLiquidIcon() {
  const size = 512;
  const logoPath = path.join(__dirname, '../public/brand/gss-logo.png');

  // 1. Trim the source GSS logo to get only the meaningful emblem/mark
  const trimmedLogoBuffer = await sharp(logoPath)
    .trim()
    .toBuffer();

  const trimmedMeta = await sharp(trimmedLogoBuffer).metadata();
  console.log('Trimmed logo size:', trimmedMeta.width, 'x', trimmedMeta.height);

  // Target emblem size inside the 512x512 liquid squircle (around 68% for balanced elegance)
  const emblemMaxDim = Math.round(size * 0.68);
  const scale = emblemMaxDim / Math.max(trimmedMeta.width, trimmedMeta.height);
  const emblemW = Math.round(trimmedMeta.width * scale);
  const emblemH = Math.round(trimmedMeta.height * scale);

  const resizedEmblem = await sharp(trimmedLogoBuffer)
    .resize(emblemW, emblemH, {
      fit: 'inside',
      kernel: sharp.kernel.lanczos3
    })
    .toBuffer();

  // 2. Create the Luxury Liquid Glass Squircle SVG background with specular lighting & transparency
  // Uses glassmorphic liquid caustics, soft inner bevel, glossy reflection dome, and subtle shadow
  const liquidSquircleSvg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Soft ambient drop shadow -->
        <filter id="liquidShadow" x="-10%" y="-10%" width="125%" height="125%" filterUnits="userSpaceOnUse">
          <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#1A73E8" flood-opacity="0.28" />
          <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#000000" flood-opacity="0.18" />
        </filter>

        <!-- Luxury Liquid Glass Gradient (Translucent White to Frosted Cyan/Sapphire) -->
        <linearGradient id="liquidGlassBody" x1="40" y1="30" x2="472" y2="482" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95" />
          <stop offset="28%" stop-color="#F4F8FE" stop-opacity="0.88" />
          <stop offset="65%" stop-color="#E8F1FC" stop-opacity="0.82" />
          <stop offset="100%" stop-color="#D9E8FA" stop-opacity="0.90" />
        </linearGradient>

        <!-- Specular Highlight Sheen (Upper Hemisphere) -->
        <linearGradient id="topSheen" x1="256" y1="36" x2="256" y2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.85" />
          <stop offset="60%" stop-color="#FFFFFF" stop-opacity="0.25" />
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.0" />
        </linearGradient>

        <!-- Refractive Rim Border Gradient -->
        <linearGradient id="glassRim" x1="40" y1="36" x2="472" y2="476" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.95" />
          <stop offset="35%" stop-color="#8AB4F8" stop-opacity="0.60" />
          <stop offset="70%" stop-color="#1A73E8" stop-opacity="0.45" />
          <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0.80" />
        </linearGradient>

        <!-- Bottom Ambient Caustics -->
        <radialGradient id="causticGlow" cx="50%" cy="85%" r="45%">
          <stop offset="0%" stop-color="#1A73E8" stop-opacity="0.22" />
          <stop offset="50%" stop-color="#FF7A00" stop-opacity="0.08" />
          <stop offset="100%" stop-color="#1A73E8" stop-opacity="0.0" />
        </radialGradient>
      </defs>

      <!-- Glass Squircle Base with Shadow -->
      <rect
        x="44"
        y="40"
        width="424"
        height="424"
        rx="112"
        fill="url(#liquidGlassBody)"
        filter="url(#liquidShadow)"
      />

      <!-- Bottom Caustic Glow -->
      <rect
        x="44"
        y="40"
        width="424"
        height="424"
        rx="112"
        fill="url(#causticGlow)"
      />

      <!-- Specular Glossy Arc (Liquid Reflection on Top Half) -->
      <path
        d="M 156 46
           C 100 46, 54 92, 52 148
           C 50 190, 80 230, 140 238
           C 210 248, 302 248, 372 238
           C 432 230, 462 190, 460 148
           C 458 92, 412 46, 356 46
           Z"
        fill="url(#topSheen)"
      />

      <!-- Precision Refractive Glass Rim (Stroke) -->
      <rect
        x="44.5"
        y="40.5"
        width="423"
        height="423"
        rx="111.5"
        stroke="url(#glassRim)"
        stroke-width="3"
        fill="none"
      />

      <!-- Micro Inner Rim Highlight for 3D Crystal Bevel -->
      <rect
        x="47"
        y="43"
        width="418"
        height="418"
        rx="109"
        stroke="#FFFFFF"
        stroke-opacity="0.55"
        stroke-width="1.5"
        fill="none"
      />
    </svg>
  `;

  // Render the liquid glass squircle
  const glassBackground = await sharp(Buffer.from(liquidSquircleSvg))
    .resize(size, size)
    .png()
    .toBuffer();

  // Composite the GSS emblem centered on top of the liquid glass capsule
  const left = Math.round((size - emblemW) / 2);
  const top = Math.round((size - emblemH) / 2);

  const finalLiquidIcon = await sharp(glassBackground)
    .composite([
      {
        input: resizedEmblem,
        left,
        top,
      },
    ])
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer();

  // 3. Save as multiple formats for optimal browser title icon display
  // Master icon.png in src/app/ for Next.js App Router metadata
  const appIconPath = path.join(__dirname, '../src/app/icon.png');
  fs.writeFileSync(appIconPath, finalLiquidIcon);
  console.log('Created:', appIconPath);

  // Apple touch icon in src/app/apple-icon.png
  const appleIcon = await sharp(finalLiquidIcon)
    .resize(180, 180, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const appleIconPath = path.join(__dirname, '../src/app/apple-icon.png');
  fs.writeFileSync(appleIconPath, appleIcon);
  console.log('Created:', appleIconPath);

  // Save to public/brand/gss-liquid-icon.png
  const publicLiquidPath = path.join(__dirname, '../public/brand/gss-liquid-icon.png');
  fs.writeFileSync(publicLiquidPath, finalLiquidIcon);
  console.log('Created:', publicLiquidPath);

  // Save to public/icon-192.png and public/icon-512.png (PWA icons)
  const icon192 = await sharp(finalLiquidIcon).resize(192, 192).png().toBuffer();
  fs.writeFileSync(path.join(__dirname, '../public/icon-192.png'), icon192);

  const icon512 = await sharp(finalLiquidIcon).resize(512, 512).png().toBuffer();
  fs.writeFileSync(path.join(__dirname, '../public/icon-512.png'), icon512);

  // 32x32 and 48x48 favicons
  const favicon32 = await sharp(finalLiquidIcon).resize(32, 32).png().toBuffer();
  const favicon48 = await sharp(finalLiquidIcon).resize(48, 48).png().toBuffer();
  const favicon16 = await sharp(finalLiquidIcon).resize(16, 16).png().toBuffer();

  // Generate multi-resolution ICO file
  // Simple ICO builder combining 16x16, 32x32, 48x48 PNGs
  const pngBuffers = [favicon16, favicon32, favicon48];
  const icoHeader = Buffer.alloc(6);
  icoHeader.writeUInt16LE(0, 0); // reserved
  icoHeader.writeUInt16LE(1, 2); // ICO type
  icoHeader.writeUInt16LE(pngBuffers.length, 4); // count

  let offset = 6 + pngBuffers.length * 16;
  const dirEntries = [];
  for (const buf of pngBuffers) {
    const meta = await sharp(buf).metadata();
    const entry = Buffer.alloc(16);
    entry.writeUInt8(meta.width === 256 ? 0 : meta.width, 0);
    entry.writeUInt8(meta.height === 256 ? 0 : meta.height, 1);
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bpp
    entry.writeUInt32LE(buf.length, 8); // size
    entry.writeUInt32LE(offset, 12); // offset
    dirEntries.push(entry);
    offset += buf.length;
  }

  const icoBuffer = Buffer.concat([icoHeader, ...dirEntries, ...pngBuffers]);
  fs.writeFileSync(path.join(__dirname, '../src/app/favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(__dirname, '../public/favicon.ico'), icoBuffer);
  console.log('Created multi-size favicon.ico');

  // Also create a standalone SVG title icon for modern browsers that support SVG favicons!
  const svgFaviconPath = path.join(__dirname, '../src/app/icon.svg');
  const base64Emblem = resizedEmblem.toString('base64');
  const standaloneSvg = `
    <svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
      ${liquidSquircleSvg.replace('</svg>', '')}
      <image href="data:image/png;base64,${base64Emblem}" x="${left}" y="${top}" width="${emblemW}" height="${emblemH}" />
    </svg>
  `.trim();
  fs.writeFileSync(svgFaviconPath, standaloneSvg);
  fs.writeFileSync(path.join(__dirname, '../public/favicon.svg'), standaloneSvg);
  console.log('Created standalone SVG title icon:', svgFaviconPath);

  console.log('Luxury Liquid Glass GSS Title Icon successfully generated across all platforms!');
}

createLiquidIcon().catch(console.error);
