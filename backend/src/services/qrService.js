const QRCode = require('qrcode');
const prisma = require('../config/db');

// The printed QR always encodes a URL pointing at the frontend's scan route,
// never the raw manhole id/qr_code_id — the scan page then extracts the
// token and calls the backend resolution endpoint. This is what makes a
// photographed QR harmless on its own: it identifies a manhole, nothing more.
const buildScanUrl = (qrToken) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/['"]/g, '');
  return `${frontendUrl}/scan/${qrToken}`;
};

const getManholeOrThrow = async (manholeId) => {
  const manhole = await prisma.manhole.findUnique({ where: { id: manholeId } });
  if (!manhole) {
    throw new Error('Manhole not found.');
  }
  return manhole;
};

// PNG buffer of just the QR square, for callers (e.g. bulk export) that
// compose their own label layout.
const generateQrPngBuffer = async (qrToken) => {
  return QRCode.toBuffer(buildScanUrl(qrToken), {
    type: 'png',
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 480,
  });
};

// Data-URI version for embedding directly in an SVG label without a second
// network round-trip.
const generateQrDataUrl = async (qrToken) => {
  return QRCode.toDataURL(buildScanUrl(qrToken), {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 480,
  });
};

// A printable label: QR code plus the human-readable manhole id and ward
// printed underneath, so a damaged/unscannable sticker can still be
// identified manually on-site. Returned as SVG (renders crisply at any
// print size, no rasterization step needed).
const generateLabelSvg = async (manhole) => {
  const qrDataUrl = await generateQrDataUrl(manhole.qr_token);
  const width = 400;
  const qrSize = 320;
  const height = qrSize + 110;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff" />
  <image x="${(width - qrSize) / 2}" y="20" width="${qrSize}" height="${qrSize}" href="${qrDataUrl}" />
  <text x="${width / 2}" y="${qrSize + 55}" text-anchor="middle" font-family="monospace" font-size="26" font-weight="700" fill="#111827">${escapeXml(manhole.qr_code_id)}</text>
  <text x="${width / 2}" y="${qrSize + 88}" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#4b5a62">Ward ${escapeXml(manhole.ward)}</text>
</svg>`;
};

const escapeXml = (value) =>
  String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[ch]));

const generateLabelForManhole = async (manholeId) => {
  const manhole = await getManholeOrThrow(manholeId);
  return generateLabelSvg(manhole);
};

const generateLabelsForAllManholes = async () => {
  const manholes = await prisma.manhole.findMany({ orderBy: { qr_code_id: 'asc' } });
  const labels = await Promise.all(
    manholes.map(async (manhole) => ({
      qr_code_id: manhole.qr_code_id,
      svg: await generateLabelSvg(manhole),
    }))
  );
  return labels;
};

module.exports = {
  buildScanUrl,
  generateQrPngBuffer,
  generateLabelForManhole,
  generateLabelsForAllManholes,
};
