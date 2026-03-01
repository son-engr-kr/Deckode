import type { Deck } from "@/types/deck";
import { assert } from "@/utils/assert";

export interface GitHubSource {
  owner: string;
  repo: string;
  path: string;
  branch: string;
}

/**
 * Parses a GitHub param string like "owner/repo[/path][@branch]"
 * into a structured object.
 */
export function parseGitHubParam(param: string): GitHubSource {
  assert(param.length > 0, "GitHub param is empty");

  let branch = "main";
  let rest = param;

  // Extract @branch suffix
  const atIdx = rest.lastIndexOf("@");
  if (atIdx !== -1) {
    branch = rest.slice(atIdx + 1);
    rest = rest.slice(0, atIdx);
    assert(branch.length > 0, "GitHub param has empty branch after @");
  }

  const parts = rest.split("/");
  assert(parts.length >= 2, `GitHub param must be "owner/repo[/path][@branch]", got "${param}"`);

  const owner = parts[0]!;
  const repo = parts[1]!;
  const path = parts.length > 2 ? parts.slice(2).join("/") : "";

  return { owner, repo, path, branch };
}

/**
 * Builds the raw.githubusercontent.com base URL for a parsed GitHub source.
 */
export function buildGitHubRawBase(source: GitHubSource): string {
  const base = `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.branch}`;
  return source.path ? `${base}/${source.path}` : base;
}

/**
 * Fetches deck.json from a GitHub repo and returns it as a Deck.
 */
export async function fetchGitHubDeck(source: GitHubSource): Promise<Deck> {
  const rawBase = buildGitHubRawBase(source);
  const url = `${rawBase}/deck.json`;

  const res = await fetch(url);
  assert(res.ok, `Failed to fetch deck.json from GitHub: ${res.status} ${res.statusText} (${url})`);

  const deck = (await res.json()) as Deck;
  assert(deck.slides !== undefined && Array.isArray(deck.slides), "Fetched JSON is not a valid Deck (missing slides array)");

  return deck;
}
