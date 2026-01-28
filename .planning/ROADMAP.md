# Roadmap: @technetcentral/gmail-mcp-server

**Created:** 2026-01-27
**Milestone:** v1.0 — Deployment Ready

## Overview

| Phase | Name | Goal | Requirements |
|-------|------|------|--------------|
| 1 | Finalize & Deploy | Package configured, built, and MCP client ready | PKG-01, PKG-02, PKG-03, DEP-01, BLD-01, BLD-02, GIT-02, GIT-03, MCP-01, MCP-02, MCP-03, VER-01, VER-02 |

## Phase 1: Finalize & Deploy

**Goal:** Complete all remaining setup tasks to make the Gmail MCP server deployment-ready

**Requirements:** PKG-01, PKG-02, PKG-03, DEP-01, BLD-01, BLD-02, GIT-02, GIT-03, MCP-01, MCP-02, MCP-03, VER-01, VER-02

**Success Criteria:**
1. `package.json` has correct name (`@technetcentral/gmail-mcp-server`), repo URL, and binary config
2. `open` package is installed and auth flow can open browser automatically
3. `npm run build` succeeds and `dist/` contains compiled JS files
4. `.gitignore` properly configured and all source files committed
5. `.mcp.json` in n8n_builder workspace configures both Gmail accounts
6. After MCP client restart, Gmail tools work and list_messages returns data

**Status:** Not Started

---

## Milestone Summary

**v1.0 — Deployment Ready**
- 1 phase
- 13 requirements (1 already complete: GIT-01)
- Focus: Get from "code exists" to "working deployment"

---
*Roadmap created: 2026-01-27*
