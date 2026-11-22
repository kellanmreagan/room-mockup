/**
 * Tiny robots.txt parser. Pure functions, no I/O.
 *
 * Matching follows the common Google/RFC9309 subset used by retailer files:
 * longest Allow/Disallow match wins; `*` is a wildcard; `$` anchors the end.
 */

export type RobotsRule = {
  type: "allow" | "disallow";
  pattern: string;
};

export type RobotsGroup = {
  userAgents: string[];
  rules: RobotsRule[];
  crawlDelay: number | null;
};

function unescapeSplitLines(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function stripComment(line: string): string {
  const hash = line.indexOf("#");
  return (hash >= 0 ? line.slice(0, hash) : line).trim();
}

export function parseRobots(robotsTxt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let current: RobotsGroup | null = null;
  let sawRules = false;

  const startGroup = (): RobotsGroup => {
    const group: RobotsGroup = { userAgents: [], rules: [], crawlDelay: null };
    groups.push(group);
    return group;
  };

  for (const raw of unescapeSplitLines(robotsTxt)) {
    const line = stripComment(raw);
    if (!line) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const field = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (field === "user-agent") {
      if (!current || sawRules) {
        current = startGroup();
        sawRules = false;
      }
      current.userAgents.push(value.toLowerCase());
      continue;
    }

    if (!current) continue;

    if (field === "allow" || field === "disallow") {
      sawRules = true;
      if (value.length === 0) continue;
      current.rules.push({ type: field, pattern: value });
      continue;
    }

    if (field === "crawl-delay") {
      sawRules = true;
      const n = Number.parseFloat(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }

  return groups;
}

function globToRegExp(pattern: string): RegExp {
  let source = pattern;
  let endAnchor = false;
  if (source.endsWith("$")) {
    endAnchor = true;
    source = source.slice(0, -1);
  }
  const escaped = source.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}${endAnchor ? "$" : ""}`);
}

function matchingGroup(groups: RobotsGroup[], userAgent: string): RobotsGroup | null {
  const ua = userAgent.trim().toLowerCase();
  let best: RobotsGroup | null = null;
  let bestLen = -1;
  let star: RobotsGroup | null = null;

  for (const group of groups) {
    for (const agent of group.userAgents) {
      if (agent === "*") {
        if (!star) star = group;
        continue;
      }
      if (ua === agent || ua.startsWith(agent)) {
        if (agent.length > bestLen) {
          best = group;
          bestLen = agent.length;
        }
      }
    }
  }

  return best ?? star;
}

function longestMatch(rules: RobotsRule[], path: string): RobotsRule | null {
  let winner: RobotsRule | null = null;
  for (const rule of rules) {
    try {
      if (!globToRegExp(rule.pattern).test(path)) continue;
    } catch {
      continue;
    }
    if (!winner) {
      winner = rule;
      continue;
    }
    if (rule.pattern.length > winner.pattern.length) {
      winner = rule;
      continue;
    }
    if (rule.pattern.length === winner.pattern.length && rule.type === "allow") {
      winner = rule;
    }
  }
  return winner;
}

export function isPathAllowed(robotsTxt: string, userAgent: string, path: string): boolean {
  const groups = parseRobots(robotsTxt);
  const group = matchingGroup(groups, userAgent);
  if (!group) return true;
  const target = path.startsWith("/") ? path : `/${path}`;
  const match = longestMatch(group.rules, target);
  if (!match) return true;
  return match.type === "allow";
}

export function crawlDelaySeconds(robotsTxt: string, userAgent: string): number | null {
  const groups = parseRobots(robotsTxt);
  const group = matchingGroup(groups, userAgent);
  return group?.crawlDelay ?? null;
}
