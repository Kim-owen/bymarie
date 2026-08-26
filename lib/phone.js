// Formats a Ghana phone number for SMS dispatch (e.g. +233 24... -> 024...).
// Previously duplicated in 4 separate places across server.js.
function formatPhoneForGhana(num) {
  let clean = String(num || '').replace(/[^0-9]/g, '');
  if (clean.startsWith('233') && clean.length === 12) clean = '0' + clean.slice(3);
  if (clean.length === 9 && !clean.startsWith('0')) clean = '0' + clean;
  return clean;
}

module.exports = { formatPhoneForGhana };
