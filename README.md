# @glp1search/mcp-server

MCP server for GLP-1 medication data and the largest provider directory. Search 18,000+ verified clinics, telehealth programs, and pharmacies from [GLP1Search.com](https://glp1search.com).

## Installation

```bash
npx @glp1search/mcp-server
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "glp1search": {
      "command": "npx",
      "args": ["-y", "@glp1search/mcp-server"]
    }
  }
}
```

### Cursor / Windsurf / Other MCP Clients

```json
{
  "glp1search": {
    "command": "npx",
    "args": ["-y", "@glp1search/mcp-server"]
  }
}
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

Get full details for a specific provider.

```
get_provider({ slug: "form-health" })
```

**Parameters:**
- `slug` (string, required) — Provider slug from search results

### compare_providers

Compare 2-3 providers side by side.

```
compare_providers({ slugs: ["ro", "hims", "form-health"] })
```

**Parameters:**
- `slugs` (string[], required) — 2-3 provider slugs to compare

### get_medication_info

Get detailed information about a GLP-1 medication.

```
get_medication_info({ medication: "semaglutide" })
get_medication_info({ medication: "ozempic" })
```

**Parameters:**
- `medication` (string, required) — Medication name or brand name

### list_medications

List all GLP-1 medications with key stats.

```
list_medications({})
```

### get_side_effect_info

Get information about a specific side effect.

```
get_side_effect_info({ effect: "nausea" })
get_side_effect_info({ effect: "hair-loss" })
```

**Parameters:**
- `effect` (string, required) — Side effect name or slug

### find_cheapest_providers

Find the lowest-cost providers in a location.

```
find_cheapest_providers({ location: "Texas", medication: "semaglutide" })
find_cheapest_providers({ location: "Nationwide" })
```

**Parameters:**
- `location` (string, required) — State, city, or "Nationwide"
- `medication` (string, optional) — Filter by medication

### get_faq

Answer a GLP-1 related question from the knowledge base.

```
get_faq({ question: "How much weight can I lose on Ozempic?" })
get_faq({ question: "What is the difference between 503A and 503B?" })
```

**Parameters:**
- `question` (string, required) — The question to answer

## Data Coverage

- **18,344 providers** across the United States
- **8 medications** including approved and pipeline drugs
- **13 side effects** with management guidance
- **16 FAQs** covering cost, safety, diet, exercise, and more
- **Provider types:** telehealth, local clinics, pharmacies, weight-loss centers, wellness centers, endocrinology, nutrition, dermatology, and more

## About

Built by [GLP1Search.com](https://glp1search.com) — the most comprehensive GLP-1 provider directory. Data is updated regularly from verified sources.

## License

MIT
