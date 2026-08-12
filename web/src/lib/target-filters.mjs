// Keep saved title exclusions compatible with newly selected target roles.
// This module is dependency-free so both the Next routes and node:test can use it.

const EARLY_CAREER_TARGET = /\b(intern(?:ship)?|co[ -]?op|student|new grad(?:uate)?|graduate|entry[ -]?level|junior)\b/i;
const EARLY_CAREER_EXCLUDE = /^(intern(?:ship)?|co[ -]?op|student|new grad(?:uate)?|graduate|entry[ -]?level|junior)$/i;

function clean(values) {
  return Array.isArray(values)
    ? values.map((value) => String(value).trim()).filter(Boolean)
    : [];
}

export function reconcileNegativeRoles(negative, roles) {
  const targets = clean(roles);
  const targetText = targets.join(" ");
  const earlyCareer = EARLY_CAREER_TARGET.test(targetText);

  return clean(negative).filter((excluded) => {
    const lowered = excluded.toLowerCase();
    const directConflict = targets.some((role) => role.toLowerCase().includes(lowered));
    if (directConflict) return false;
    if (earlyCareer && EARLY_CAREER_EXCLUDE.test(excluded)) return false;
    return true;
  });
}

export function expandLocationTargets(locations) {
  const expanded = [];
  for (const location of clean(locations)) {
    expanded.push(location);
    for (const part of location.split(",")) {
      const value = part.trim();
      // Two-letter province/state abbreviations (for example ON) are too broad
      // for substring matching, but full city/region/country names are useful.
      if (value.length >= 3) expanded.push(value);
    }
  }
  return [...new Map(expanded.map((value) => [value.toLowerCase(), value])).values()];
}
