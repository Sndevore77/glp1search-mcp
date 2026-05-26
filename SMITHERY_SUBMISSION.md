# Smithery submission — GLP1Search MCP

The official MCP registry already lists us at
`io.github.Sndevore77/glp1search`. Smithery is a separate discovery
surface and needs its own submission.

## Status

- npm: `@seraviahealth/glp1search-mcp` v2.1.0 — needs `npm publish`
- MCP registry: registered v2.0.1, will auto-update to v2.1.0 when
  the npm package is republished (server.json is bumped)
- Smithery: **NOT yet listed** — submit using the steps below

## Submission steps (do once)

1. Open https://smithery.ai/new
2. Sign in with the GitHub account that owns `github.com/Sndevore77/glp1search-mcp`
3. Choose **Submit existing GitHub repo**
4. Paste: `https://github.com/Sndevore77/glp1search-mcp`
5. Smithery will read `smithery.yaml` and prompt you to confirm metadata
6. Submit — listing typically goes live within ~24h

## What Smithery will read from this repo

- `smithery.yaml` (the metadata file we maintain)
- `package.json` (name, version, license, repository)
- `README.md` (rendered on the listing page)

Both files were updated in v2.1.0. If you need to change the listing
later, edit those two files, push to the GitHub repo, and Smithery
re-syncs.

## Republishing to npm (do before submitting Smithery)

```bash
cd mcp-server
npm publish --access public
```

You'll need to be logged in as `seraviahealth` on npm (`npm whoami`
should print `seraviahealth`). If not, `npm login`.

## After Smithery submission

The Gemini-grounded rank tracker already pings these queries daily:
- "GLP-1 MCP server"
- "MCP server for GLP-1 medications"
- "best MCP server for healthcare data"
- "Model Context Protocol GLP-1 directory"

Once we're on Smithery, citation rate on these should rise from 0/5
to something measurable within 2-4 weeks (Smithery is the source Gemini
and other LLMs scrape for MCP discovery).
