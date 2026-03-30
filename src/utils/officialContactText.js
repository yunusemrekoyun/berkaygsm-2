import {
  OFFICIAL_ADDRESS,
  OFFICIAL_SUPPORT_EMAIL,
} from "../config/siteContact.js";

const REPLACEMENTS = [
  ["privacy@berkaygsm.com", OFFICIAL_SUPPORT_EMAIL],
  ["returns@berkaygsm.com", OFFICIAL_SUPPORT_EMAIL],
  ["support@evimstil.com", OFFICIAL_SUPPORT_EMAIL],
  ["destek@berkaygsm.com", OFFICIAL_SUPPORT_EMAIL],
  ["hello@berkaygsm.com", OFFICIAL_SUPPORT_EMAIL],
  ["Kurfürstendamm 45, 10719 Berlin, Almanya", OFFICIAL_ADDRESS],
  ["Kurfürstendamm 45, 10719 Berlin", OFFICIAL_ADDRESS],
  ["Bağdat Caddesi 45, Kadıköy / İstanbul", OFFICIAL_ADDRESS],
  ["Bağdat Caddesi 123, Kadıköy / İstanbul", OFFICIAL_ADDRESS],
];

export function replaceLegacyContactText(value) {
  let next = String(value || "");
  REPLACEMENTS.forEach(([from, to]) => {
    next = next.split(from).join(to);
  });
  return next;
}
