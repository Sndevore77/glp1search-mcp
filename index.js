#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

function loadJSON(relativePath) {
  try {
    const raw = readFileSync(join(__dirname, relativePath), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Try bundled data first, then fall back to the Web source data
const providers =
  loadJSON("data/providers.json") ??
  loadJSON("../Web/src/data/master_directory.json") ??
  [];

const medications = loadJSON("data/medications.json") ?? [];
const sideEffects = loadJSON("data/side-effects.json") ?? [];
const faqs = loadJSON("data/faqs.json") ?? [];

// Build slug-keyed lookup maps
const providerMap = new Map(providers.map((p) => [p.slug, p]));
const medicationMap = new Map(medications.map((m) => [m.slug, m]));
const sideEffectMap = new Map(sideEffects.map((s) => [s.slug, s]));

const BASE_URL = "https://glp1search.com";
const SOURCE = "GLP1Search.com";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function providerUrl(slug) {
  return `${BASE_URL}/providers/${slug}`;
}

function formatProvider(p, full = false) {
  const summary = {
    name: p.name,
    slug: p.slug,
    type: p.type,
    category: p.category || undefined,
    medications: p.meds || undefined,
    price: p.price || undefined,
    pharmacy: p.pharmacy || undefined,
    rating: p.rating || undefined,
    reviewCount: p.reviewCount || undefined,
    phone: p.phone || undefined,
    website: p.website || undefined,
    location: p.location || undefined,
    url: providerUrl(p.slug),
    source: SOURCE,
  };

  if (full) {
    summary.email = p.email || undefined;
    summary.attributes = p.attributes || undefined;
  }

  // Strip undefined keys for cleaner output
  return Object.fromEntries(
    Object.entries(summary).filter(([, v]) => v !== undefined)
  );
}

function searchScore(provider, query, stateFilter, typeFilter) {
  const q = query.toLowerCase();
  const name = (provider.name || "").toLowerCase();
  const location = (provider.location || "").toLowerCase();
  const meds = (provider.meds || "").toLowerCase();
  const type = (provider.type || "").toLowerCase();
  const category = (provider.category || "").toLowerCase();

  // Hard filters
  if (stateFilter) {
    const sf = stateFilter.toLowerCase();
    if (!location.includes(sf)) return -1;
  }
  if (typeFilter) {
    const tf = typeFilter.toLowerCase();
    if (type !== tf && category.toLowerCase() !== tf) return -1;
  }

  let score = 0;
  if (name.includes(q)) score += 10;
  if (name.startsWith(q)) score += 5;
  if (location.includes(q)) score += 3;
  if (meds.includes(q)) score += 3;
  if (type.includes(q)) score += 2;
  if (category.includes(q)) score += 2;

  // Boost rated providers
  if (provider.rating) score += 1;
  if (provider.reviewCount > 100) score += 1;

  return score;
}

function faqScore(faq, question) {
  const q = question.toLowerCase();
  const faqQ = faq.question.toLowerCase();
  const faqA = faq.answer.toLowerCase();
  const tags = (faq.tags || []).map((t) => t.toLowerCase());

  let score = 0;
  const words = q.split(/\s+/).filter((w) => w.length > 2);

  for (const word of words) {
    if (faqQ.includes(word)) score += 3;
    if (faqA.includes(word)) score += 1;
    if (tags.some((t) => t.includes(word))) score += 2;
  }

  return score;
}

function parsePriceNumber(priceStr) {
  if (!priceStr) return Infinity;
  const match = priceStr.match(/\$[\d,]+/);
  if (!match) return Infinity;
  return parseFloat(match[0].replace(/[$,]/g, ""));
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "@glp1search/mcp-server",
  version: "1.0.0",
});

// -- search_providers -------------------------------------------------------

server.tool(
  "search_providers",
  `Search the GLP1Search.com directory of 18,000+ GLP-1 medication providers. Find clinics, telehealth programs, weight loss centers, and pharmacies. Use this to help users find GLP-1 providers by name, location, type, or medication.`,
  {
    query: z
      .string()
      .describe(
        "Search term — provider name, city, state, medication name, or provider type"
      ),
    state: z
      .string()
      .optional()
      .describe(
        "Filter by US state name (e.g. 'California', 'Texas', 'Nationwide' for telehealth)"
      ),
    type: z
      .string()
      .optional()
      .describe(
        "Filter by provider type: telehealth, local, clinic, pharmacy, weight-loss, wellness, endocrinology, nutrition, dermatology, cosmetic-surgery, integrative, chiropractic, acupuncture"
      ),
    limit: z
      .number()
      .optional()
      .default(10)
      .describe("Maximum number of results to return (default 10, max 25)"),
  },
  async ({ query, state, type, limit }) => {
    const cap = Math.min(limit || 10, 25);

    const scored = providers
      .map((p) => ({ provider: p, score: searchScore(p, query, state, type) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, cap);

    if (scored.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                results: [],
                message: `No providers found matching "${query}". Try broadening your search or visit ${BASE_URL} to browse all providers.`,
                source: SOURCE,
                url: BASE_URL,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const results = scored.map((s) => formatProvider(s.provider));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              query,
              count: results.length,
              totalProviders: providers.length,
              results,
              source: SOURCE,
              url: `${BASE_URL}/search?q=${encodeURIComponent(query)}`,
              note: "Visit GLP1Search.com to see full profiles, reviews, and compare providers.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// -- get_provider -----------------------------------------------------------

server.tool(
  "get_provider",
  `Get full details for a specific GLP-1 provider from GLP1Search.com. Use the provider's slug (URL-friendly name) to retrieve complete information including ratings, contact details, pricing, and medications offered.`,
  {
    slug: z
      .string()
      .describe(
        "Provider slug (URL-friendly identifier, e.g. 'form-health', 'ro', 'hims')"
      ),
  },
  async ({ slug }) => {
    const provider = providerMap.get(slug.toLowerCase());

    if (!provider) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `Provider "${slug}" not found. Use search_providers to find the correct slug.`,
                source: SOURCE,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ...formatProvider(provider, true),
              note: `View full profile with reviews at ${providerUrl(slug)}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// -- compare_providers ------------------------------------------------------

server.tool(
  "compare_providers",
  `Compare 2-3 GLP-1 providers side by side. Returns a comparison of pricing, medications, ratings, and other key details. Useful when a user is deciding between providers.`,
  {
    slugs: z
      .array(z.string())
      .min(2)
      .max(3)
      .describe(
        "Array of 2-3 provider slugs to compare (e.g. ['ro', 'hims', 'form-health'])"
      ),
  },
  async ({ slugs }) => {
    const results = slugs.map((slug) => {
      const provider = providerMap.get(slug.toLowerCase());
      if (!provider) {
        return { slug, error: `Provider "${slug}" not found` };
      }
      return formatProvider(provider, true);
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              comparison: results,
              source: SOURCE,
              url: BASE_URL,
              note: "Visit GLP1Search.com for full profiles, reviews, and detailed comparisons.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// -- get_medication_info ----------------------------------------------------

server.tool(
  "get_medication_info",
  `Get detailed information about a GLP-1 or weight loss medication. Includes brand names, dosing, average weight loss, side effects, cost, and whether compounded versions are available. Covers semaglutide, tirzepatide, liraglutide, dulaglutide, exenatide, and pipeline drugs.`,
  {
    medication: z
      .string()
      .describe(
        "Medication name or slug (e.g. 'semaglutide', 'tirzepatide', 'ozempic', 'wegovy', 'mounjaro', 'zepbound')"
      ),
  },
  async ({ medication }) => {
    const q = medication.toLowerCase().trim();

    // Try direct slug match first
    let med = medicationMap.get(q);

    // Try matching by brand name
    if (!med) {
      med = medications.find(
        (m) =>
          m.brandNames.some((b) => b.toLowerCase() === q) ||
          m.name.toLowerCase() === q
      );
    }

    if (!med) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `Medication "${medication}" not found. Available medications: ${medications.map((m) => m.name).join(", ")}`,
                source: SOURCE,
                url: BASE_URL,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ...med,
              source: SOURCE,
              url: `${BASE_URL}/medications/${med.slug}`,
              findProviders: `Use search_providers to find providers offering ${med.name}`,
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// -- list_medications -------------------------------------------------------

server.tool(
  "list_medications",
  `List all GLP-1 and weight loss medications with key stats. Returns name, brand names, class, average weight loss, cost range, and approval status. Good starting point for medication comparisons.`,
  {},
  async () => {
    const summary = medications.map((m) => ({
      name: m.name,
      slug: m.slug,
      brandNames: m.brandNames,
      class: m.class,
      averageWeightLoss: m.averageWeightLoss,
      administration: m.administration,
      compoundedAvailable: m.compoundedAvailable,
      averageCost: m.averageCost,
      approvedFor: m.approvedFor,
    }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              medications: summary,
              count: summary.length,
              source: SOURCE,
              url: BASE_URL,
              note: "Use get_medication_info for detailed information about a specific medication.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// -- get_side_effect_info ---------------------------------------------------

server.tool(
  "get_side_effect_info",
  `Get detailed information about a GLP-1 medication side effect. Includes frequency, severity, duration, management tips, and when to seek medical help. Use this when someone asks about a specific side effect they are experiencing or concerned about.`,
  {
    effect: z
      .string()
      .describe(
        "Side effect name or slug (e.g. 'nausea', 'hair-loss', 'constipation', 'pancreatitis', 'muscle-loss')"
      ),
  },
  async ({ effect }) => {
    const q = effect.toLowerCase().trim().replace(/\s+/g, "-");

    // Try slug match
    let se = sideEffectMap.get(q);

    // Try name match
    if (!se) {
      se = sideEffects.find((s) => s.name.toLowerCase() === effect.toLowerCase().trim());
    }

    // Try partial match
    if (!se) {
      se = sideEffects.find(
        (s) =>
          s.name.toLowerCase().includes(effect.toLowerCase().trim()) ||
          s.slug.includes(q)
      );
    }

    if (!se) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                error: `Side effect "${effect}" not found. Available topics: ${sideEffects.map((s) => s.name).join(", ")}`,
                source: SOURCE,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              ...se,
              source: SOURCE,
              url: BASE_URL,
              disclaimer:
                "This information is for educational purposes only. Always consult your healthcare provider about side effects.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// -- find_cheapest_providers ------------------------------------------------

server.tool(
  "find_cheapest_providers",
  `Find the lowest-cost GLP-1 providers in a specific location. Searches by state or city and returns providers sorted by price. Useful for budget-conscious users looking for affordable GLP-1 medications.`,
  {
    location: z
      .string()
      .describe(
        "State name, city, or 'Nationwide' for telehealth providers (e.g. 'Texas', 'Los Angeles', 'Nationwide')"
      ),
    medication: z
      .string()
      .optional()
      .describe(
        "Filter by medication (e.g. 'Semaglutide', 'Tirzepatide')"
      ),
  },
  async ({ location, medication }) => {
    const loc = location.toLowerCase();
    const med = medication?.toLowerCase();

    const filtered = providers.filter((p) => {
      const pLoc = (p.location || "").toLowerCase();
      if (!pLoc.includes(loc)) return false;
      if (med) {
        const pMeds = (p.meds || "").toLowerCase();
        if (!pMeds.includes(med)) return false;
      }
      // Must have a parseable price
      if (!p.price || parsePriceNumber(p.price) === Infinity) return false;
      return true;
    });

    const sorted = filtered
      .sort((a, b) => parsePriceNumber(a.price) - parsePriceNumber(b.price))
      .slice(0, 15);

    if (sorted.length === 0) {
      // Fall back to telehealth options
      const telehealth = providers
        .filter((p) => {
          if (p.type !== "telehealth") return false;
          if (med) {
            const pMeds = (p.meds || "").toLowerCase();
            if (!pMeds.includes(med)) return false;
          }
          if (!p.price || parsePriceNumber(p.price) === Infinity) return false;
          return true;
        })
        .sort((a, b) => parsePriceNumber(a.price) - parsePriceNumber(b.price))
        .slice(0, 10);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                location,
                localResults: [],
                message: `No local providers with pricing found in "${location}". Here are the most affordable nationwide telehealth options:`,
                telehealthOptions: telehealth.map((p) => formatProvider(p)),
                source: SOURCE,
                url: BASE_URL,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              location,
              medication: medication || "All GLP-1 medications",
              count: sorted.length,
              results: sorted.map((p) => formatProvider(p)),
              source: SOURCE,
              url: `${BASE_URL}/search?q=${encodeURIComponent(location)}`,
              note: "Prices shown are as reported by providers and may vary. Contact providers directly for current pricing.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// -- get_faq ----------------------------------------------------------------

server.tool(
  "get_faq",
  `Answer a GLP-1 or weight loss medication question. Searches a curated knowledge base of frequently asked questions about GLP-1 medications, side effects, costs, providers, diet, exercise, and more. Use this for general GLP-1 questions.`,
  {
    question: z
      .string()
      .describe(
        "The question to answer (e.g. 'How much weight can I lose?', 'What are the side effects?', 'How much does it cost?')"
      ),
  },
  async ({ question }) => {
    const scored = faqs
      .map((f) => ({ faq: f, score: faqScore(f, question) }))
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                question,
                answer:
                  "I don't have a specific answer for that question in the FAQ database. Visit GLP1Search.com for more information, or use the other tools to search providers, medications, or side effects.",
                source: SOURCE,
                url: BASE_URL,
              },
              null,
              2
            ),
          },
        ],
      };
    }

    const best = scored[0].faq;
    const related = scored
      .slice(1, 4)
      .map((s) => ({ question: s.faq.question, slug: s.faq.slug }));

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              question: best.question,
              answer: best.answer,
              tags: best.tags,
              relatedQuestions: related.length > 0 ? related : undefined,
              source: SOURCE,
              url: BASE_URL,
              disclaimer:
                "This information is for educational purposes only and is not medical advice. Consult a healthcare provider for personalized guidance.",
            },
            null,
            2
          ),
        },
      ],
    };
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
