# GLP1Search MCP Server

MCP server for GLP-1 medication data and the largest provider directory in the US. Search 18,344 verified clinics, telehealth programs, and pharmacies. Built by [GLP1Search.com](https://glp1search.com).

## Data

- **18,344 providers** with contact info, ratings, pricing, and addresses
- **8 medications** — semaglutide, tirzepatide, liraglutide, and more
- **25 side effects** with management guidance
- **15 FAQs** covering cost, safety, eligibility, and lifestyle

## Installation

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "glp1search": {
      "command": "npx",
      "args": ["-y", "github:Sndevore77/glp1search-mcp"]
    }
  }
}
```

### Cursor / Windsurf / Other MCP Clients

```json
{
  "glp1search": {
    "command": "npx",
    "args": ["-y", "github:Sndevore77/glp1search-mcp"]
  }
}
```

### Manual

```bash
git clone https://github.com/Sndevore77/glp1search-mcp.git
cd glp1search-mcp
npm install
node index.js
```

## Tools

### search_providers

Search the provider directory by name, city, state, type, or medication.

```
search_providers({ query: "telehealth semaglutide", state: "Nationwide", limit: 5 })
```

**Parameters:**
- `query` (string, required) — Search term
- `state` (string, optional) — Filter by state
- `type` (string, optional) — Filter by type: telehealth, local, clinic, pharmacy, weight-loss, wellness, endocrinology, etc.
- `limit` (number, optional) — Max results (default 10, max 25)

### get_provider

Get full details for a specific provider including ratings, contact info, and address.

```
get_provider({ slug: "form-health" })
```

### compare_providers

Compare 2-3 providers side by side on pricing, medications, and ratings.

```
compare_providers({ slugs: ["ro", "hims", "form-health"] })
```

### get_medication_info

Get detailed information about a GLP-1 medication — dosing, trials, costs, side effects.

```
get_medication_info({ medication: "semaglutide" })
get_medication_info({ medication: "ozempic" })
```

### list_medications

List all GLP-1 medications with key stats.

```
list_medications({})
```

### get_side_effect_info

Get side effect details — frequency, severity, management tips, when to see a doctor.

```
get_side_effect_info({ effect: "nausea" })
```

### find_cheapest_providers

Find the lowest-cost providers in a location.

```
find_cheapest_providers({ location: "Texas", medication: "semaglutide" })
```

### get_faq

Answer a GLP-1 question from the knowledge base.

```
get_faq({ question: "How much weight can I lose on Ozempic?" })
```

## Use Cases

- **Patient research** — Find and compare GLP-1 providers by location and price
- **Clinical Q&A** — Answer medication questions with cited, structured data
- **Cost comparison** — Help users find affordable GLP-1 treatment options
- **Side effect guidance** — Provide management strategies for common side effects

## About

Built by [GLP1Search.com](https://glp1search.com) — the most comprehensive GLP-1 provider directory. Updated regularly.

## License

MIT
