const prisma = require('../config/db');

// Pure identity lookup: resolves a scanned qr_token to a manhole. Does not
// create a PermitEntry, does not check work-order assignment, and carries no
// authorization meaning on its own — a photographed/reused QR only proves
// which manhole it points to, never that the holder is allowed to open a
// permit against it. Real authorization runs later, in permitService, on the
// permit-open request itself.
const resolveManholeByToken = async (qrToken) => {
  const manhole = await prisma.manhole.findUnique({
    where: { qr_token: qrToken },
  });

  // Same generic message whether the token is malformed or simply unknown —
  // distinguishing the two only helps an attacker probe for valid formats.
  if (!manhole) {
    throw new Error('Unrecognized code.');
  }

  return {
    id: manhole.id,
    qr_code_id: manhole.qr_code_id,
    ward: manhole.ward,
    lat: manhole.lat,
    lng: manhole.lng,
  };
};

module.exports = {
  resolveManholeByToken,
};
