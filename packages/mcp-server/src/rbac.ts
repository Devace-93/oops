/**
 * Tool-level authorization.
 *
 * Every tool declares the scope(s) it needs. The server consults this table
 * twice (defense in depth):
 *
 *   1. at registration — tools the key cannot use are never listed, so the
 *      model is not tempted to call them;
 *   2. at call time — a tool that is somehow invoked without its scope is
 *      refused and the refusal is audited.
 *
 * The REST API enforces the same scopes independently (layer 3), so a bug in
 * this file can never *grant* access, only hide it.
 *
 * The table mirrors the "MCP server" section of CONTRACT.md; the roles that
 * grant each scope live in packages/shared/api_key_roles.json.
 */
import type { Scope } from "./types.js";

export const TOOL_SCOPES = {
  // projects
  list_projects: ["projects:read"],
  get_project: ["projects:read"],
  create_project: ["projects:write"],
  update_project: ["projects:write"],
  rotate_public_key: ["projects:write"],
  delete_project: ["projects:delete"],
  // issues and events
  list_issues: ["issues:read"],
  get_issue: ["issues:read"],
  list_issue_events: ["issues:read"],
  get_event: ["issues:read"],
  search_events: ["issues:read"],
  update_issue: ["issues:write"],
  bulk_update_issues: ["issues:write"],
  // stats
  get_stats: ["issues:read"],
  get_live: ["issues:read"],
  purge_events: ["events:delete"],
  // account
  get_usage: ["usage:read"],
  get_audit_log: ["audit:read"],
  // reporting: needs to read the project's public key, then posts to /ingest
  report_error: ["projects:read"],
} as const satisfies Record<string, readonly Scope[]>;

export type ToolName = keyof typeof TOOL_SCOPES;

export const ALL_TOOLS = Object.keys(TOOL_SCOPES) as ToolName[];

/** Tools that never run without explicit user confirmation. */
export const CONFIRMED_TOOLS: readonly ToolName[] = ["delete_project", "purge_events"];

export function hasScope(scopes: Iterable<Scope>, scope: Scope): boolean {
  for (const s of scopes) if (s === scope) return true;
  return false;
}

/** True when every scope the tool needs is granted. */
export function hasAllScopes(scopes: Iterable<Scope>, required: readonly Scope[]): boolean {
  const set = new Set(scopes);
  return required.every((s) => set.has(s));
}

export function allowedTools(scopes: Iterable<Scope>): ToolName[] {
  const set = new Set(scopes);
  return ALL_TOOLS.filter((tool) => TOOL_SCOPES[tool].every((s) => set.has(s)));
}
