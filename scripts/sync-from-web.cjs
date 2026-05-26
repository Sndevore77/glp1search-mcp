#!/usr/bin/env node
/**
 * sync-from-web.cjs
 *
 * Pulls the canonical Web data files into the MCP server's data/ directory,
 * transforming Web's richer schema into the field shape MCP tools expect.
 *
 * Why this exists:
 *   The Web project (/Web/src/data/) is the source of truth — it's updated
 *   continuously by the directory + content pipelines. The MCP server,
 *   published as @seraviahealth/glp1search-mcp, was drifting behind.
 *   This script keeps them in sync without breaking existing MCP tool clients
 *   that may rely on specific field names.
 *
 * Strategy:
 *   - Pass through fields that match (name, slug, etc.)
 *   - Map richer Web fields onto MCP's expected aliases (genericName → name)
 *   - Keep BOTH old and new fields so old clients keep working and richer
 *     data is also available to new clients
 *   - Add files that exist on Web but not in MCP (conditions.json)
 *
 * Run: node scripts/sync-from-web.cjs
 * Then: bump version in package.json, npm publish
 */

const fs = require("fs");
const path = require("path");

const WEB_DATA = path.join(__dirname, "..", "..", "Web", "src", "data");
const MCP_DATA = path.join(__dirname, "..", "data");

if (!fs.existsSync(WEB_DATA)) {
  console.error(`Web data dir not found at ${WEB_DATA}`);
  process.exit(1);
}
fs.mkdirSync(MCP_DATA, { recursive: true });

const read = (rel, root = WEB_DATA) =>
  JSON.parse(fs.readFileSync(path.join(root, rel), "utf-8"));
const write = (rel, data) => {
  fs.writeFileSync(path.join(MCP_DATA, rel), JSON.stringify(data, null, 2));
  return fs.statSync(path.join(MCP_DATA, rel)).size;
};
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

// ─── providers.json (from master_directory.json) ─────────────────
// MCP's formatProvider reads: name, slug, type, category, meds, price,
// pharmacy, rating, reviewCount, phone, website, location, email, attributes.
// Web has all of those + address, hours, lat/lng, googlePlaceId, city,
// state, zip. Keep everything; MCP tools just ignore extra fields.
console.log("─── providers.json ───");
const masterDir = read("master_directory.json");
const providersSize = write(
  "providers.json",
  masterDir.map((p) => ({
    name: p.name,
    slug: p.slug,
    type: p.type,
    category: p.category,
    meds: p.meds,
    price: p.price,
    pharmacy: p.pharmacy,
    location: p.location,
    rating: p.rating,
    reviewCount: p.reviewCount,
    phone: p.phone,
    email: p.email,
    website: p.website,
    address: p.address,
    city: p.city,
    state: p.state,
    zip: p.zip,
    lat: p.lat,
    lng: p.lng,
    attributes: p.attributes,
    hours: p.hours,
  })),
);
console.log(`  ${masterDir.length} providers → ${kb(providersSize)}`);

// ─── medications.json ────────────────────────────────────────────
// MCP needs: name, slug, brandNames, class, averageWeightLoss, administration,
// compoundedAvailable, averageCost, approvedFor.
// Web has: genericName, brandNames, class, mechanism, administration,
// dosingSchedule, typicalDoses, titrationSchedule, averageWeightLoss,
// fdaApproved, fdaApprovalYear, commonSideEffects, seriousRisks,
// contraindications, pharmacyTypes, typicalMonthlyCost, insuranceCoverage,
// halfLife, clinicalTrials, keyResults, competitors, keyAdvantages,
// keyDisadvantages, manufacturer, seraviaRelevance.
// Mapping: name = genericName. compoundedAvailable = pharmacyTypes includes
// "compounded" or "503A/503B" mentions. averageCost = formatted brand cost.
// approvedFor = derived from brand indications.
console.log("─── medications.json ───");
const webMedsRaw = read("medications.json");
const webMeds = webMedsRaw.medications || webMedsRaw;
const medsTransformed = webMeds.map((m) => {
  const compoundedAvailable = !!(
    m.pharmacyTypes &&
    /compound|503[ab]/i.test(JSON.stringify(m.pharmacyTypes))
  );
  const cost = m.typicalMonthlyCost || {};
  const averageCost = cost.brand
    ? `${cost.brand}${cost.compounded && !/not yet|n\/a/i.test(cost.compounded) ? ` (brand); ${cost.compounded} (compounded)` : ""}`
    : undefined;
  const approvedFor = m.brandNames
    ? m.brandNames
        .filter((b) => typeof b === "object" && b.indication)
        .map((b) => `${b.name}: ${b.indication}`)
        .join("; ") || (m.fdaApproved ? "FDA-approved" : "Investigational")
    : undefined;
  return {
    // MCP-expected fields
    name: m.genericName || m.name,
    slug: m.slug,
    brandNames: m.brandNames,
    class: m.class,
    averageWeightLoss: m.averageWeightLoss,
    administration: m.administration,
    compoundedAvailable,
    averageCost,
    approvedFor,
    // Richer Web fields (new clients can use these)
    genericName: m.genericName,
    mechanism: m.mechanism,
    dosingSchedule: m.dosingSchedule,
    typicalDoses: m.typicalDoses,
    titrationSchedule: m.titrationSchedule,
    fdaApproved: m.fdaApproved,
    fdaApprovalYear: m.fdaApprovalYear,
    commonSideEffects: m.commonSideEffects,
    seriousRisks: m.seriousRisks,
    contraindications: m.contraindications,
    pharmacyTypes: m.pharmacyTypes,
    typicalMonthlyCost: m.typicalMonthlyCost,
    insuranceCoverage: m.insuranceCoverage,
    halfLife: m.halfLife,
    clinicalTrials: m.clinicalTrials,
    keyResults: m.keyResults,
    competitors: m.competitors,
    keyAdvantages: m.keyAdvantages,
    keyDisadvantages: m.keyDisadvantages,
    manufacturer: m.manufacturer,
  };
});
const medsSize = write("medications.json", medsTransformed);
console.log(`  ${medsTransformed.length} medications → ${kb(medsSize)}`);

// ─── side-effects.json ───────────────────────────────────────────
// MCP needs: slug, name, frequency, severity, duration, description,
// management (array), whenToSeekHelp, affectedMedications.
// Web has: slug, name, category, description, faqQuestions, managementTips,
// medications, prevalence, relatedEffects, seraviaProduct, severity,
// timeline, whenToSeeDoctor, whyItHappens.
// Mapping: frequency = prevalence. duration = timeline. management =
// managementTips. whenToSeekHelp = whenToSeeDoctor. affectedMedications =
// medications.
console.log("─── side-effects.json ───");
const webSeRaw = read("side-effects.json");
const webSe = webSeRaw.sideEffects || webSeRaw;
const seTransformed = webSe.map((s) => ({
  slug: s.slug,
  name: s.name,
  frequency: s.prevalence,
  severity: s.severity,
  duration: s.timeline,
  description: s.description,
  management: s.managementTips,
  whenToSeekHelp: s.whenToSeeDoctor,
  affectedMedications: s.medications,
  // Richer fields
  category: s.category,
  whyItHappens: s.whyItHappens,
  relatedEffects: s.relatedEffects,
  seraviaProduct: s.seraviaProduct,
  faqQuestions: s.faqQuestions,
}));
const seSize = write("side-effects.json", seTransformed);
console.log(`  ${seTransformed.length} side effects → ${kb(seSize)}`);

// ─── faqs.json (identical structure, just copy) ──────────────────
console.log("─── faqs.json ───");
const faqs = read("faqs.json");
const faqsSize = write("faqs.json", faqs);
console.log(`  ${Array.isArray(faqs) ? faqs.length : Object.keys(faqs).length} entries → ${kb(faqsSize)}`);

// ─── peptides.json (identical) ───────────────────────────────────
console.log("─── peptides.json ───");
const peptides = read("peptides.json");
const peptidesSize = write("peptides.json", peptides);
console.log(`  ${Array.isArray(peptides) ? peptides.length : "?"} entries → ${kb(peptidesSize)}`);

// ─── comparisons.json (identical) ────────────────────────────────
console.log("─── comparisons.json ───");
const comparisons = read("comparisons.json");
const cmpSize = write("comparisons.json", comparisons);
console.log(`  ${Array.isArray(comparisons) ? comparisons.length : "?"} entries → ${kb(cmpSize)}`);

// ─── conditions.json (NEW — wasn't in MCP) ───────────────────────
console.log("─── conditions.json (NEW) ───");
const conditions = read("conditions.json");
const condSize = write("conditions.json", conditions);
console.log(`  ${Array.isArray(conditions) ? conditions.length : "?"} conditions → ${kb(condSize)}`);

console.log("\n✓ Sync complete. Next steps:");
console.log("  1. Review changes:  git diff mcp-server/data/");
console.log("  2. Test the server: cd mcp-server && node index.js  (then ctrl-c)");
console.log("  3. Bump version in package.json (2.0.1 → 2.1.0)");
console.log("  4. Publish:         npm publish --access public");
