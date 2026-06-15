import { execSync } from "node:child_process";

export function captureDiff(maxLen = 4000): string {
  try {
    const out = execSync("git diff --no-color", {
      encoding: "utf-8",
      timeout: 2000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.trim() ? out.slice(0, maxLen) : "(no diff)";
  } catch {
    return "(git diff failed)";
  }
}

export function gitBranch(): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", {
      encoding: "utf-8",
      timeout: 1000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "—";
  }
}

export function gitCounts(): { changed: number; staged: number } {
  try {
    const out = execSync("git status --porcelain", {
      encoding: "utf-8",
      timeout: 1000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const lines = out.split("\n").filter(Boolean);
    return {
      changed: lines.filter((l) => l.slice(2).trim().length > 0).length,
      staged: lines.filter((l) => l[0] !== " " && l[0] !== "?").length,
    };
  } catch {
    return { changed: 0, staged: 0 };
  }
}
