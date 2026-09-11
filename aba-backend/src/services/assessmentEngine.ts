import { GRIDS, GOAL_BANK, type GridDefinition, type GoalBankEntry } from './assessmentGrids';

// ─── Scoring, Aggregation, Evaluation & Goal Suggestion Engine ───────────────

export interface ScoreInput {
  itemCode: string;
  domainCode: string;
  level: number;
  score: number;
  notes?: string | null;
}

export interface StoredScore extends ScoreInput {
  id?: string;
  notes?: string | null;
}

export interface DomainResult {
  code: string;
  name: string;
  level: number;
  total: number;
  max: number;
  percentage: number;
}

export interface ItemDeficit {
  itemCode: string;
  domainCode: string;
  level: number;
  score: number;
  maxScore: number;
  message: string;
}

export interface Flag {
  type: 'MASTERY' | 'LACK_OF_PROGRESS' | 'REGRESSION' | 'DEFICIT';
  itemCode?: string;
  domainCode?: string;
  message: string;
}

export interface SuggestedGoal {
  targetId: string;
  goalTitle: string;
  category: string;
  operationalDefinition: string;
  measurementType: string;
  masteryCriteria: string;
  reason: string;
  severity: number; // 0-100, percentage below max
}

// ── Validate score entries against the grid definition ──────────────────────
export function validateScores(assessmentType: string, scores: ScoreInput[]): { valid: boolean; errors: string[] } {
  const grid: GridDefinition | undefined = GRIDS[assessmentType];
  const errors: string[] = [];
  if (!grid) {
    return { valid: false, errors: [`Unknown assessment type: ${assessmentType}`] };
  }

  const allowed = grid.scoringScale;
  const seen = new Set<string>();
  const validItemCodes = new Set(buildItemCodes(grid));

  for (const s of scores) {
    if (!s.itemCode || typeof s.itemCode !== 'string') {
      errors.push('Each score entry must include an itemCode');
      continue;
    }
    if (!validItemCodes.has(s.itemCode)) {
      errors.push(`Unknown item code: ${s.itemCode}`);
      continue;
    }
    if (seen.has(s.itemCode)) {
      errors.push(`Duplicate score entry for ${s.itemCode}`);
      continue;
    }
    seen.add(s.itemCode);

    if (typeof s.score !== 'number' || !allowed.includes(s.score)) {
      errors.push(`Invalid score ${s.score} for ${s.itemCode}. Allowed: ${allowed.join(', ')}`);
    }
    if (typeof s.notes !== 'undefined' && s.notes !== null && typeof s.notes !== 'string') {
      errors.push(`Notes for ${s.itemCode} must be a string`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// Build every item code for a grid (used for validation + master grid rendering)
export function buildItemCodes(grid: GridDefinition): string[] {
  const codes: string[] = [];
  if (grid.assessmentType === 'VB_MAPP_GRID' && grid.levels) {
    for (const lvl of grid.levels) {
      for (const domain of lvl.domains) {
        for (let i = 1; i <= domain.totalItems; i++) {
          codes.push(`${domain.code}_L${lvl.level}_${i}`);
        }
      }
    }
  } else if (grid.assessmentType === 'ABLLS_GRID' && grid.domainsAtoZ) {
    for (const domain of grid.domainsAtoZ) {
      for (let i = 1; i <= domain.totalItems; i++) {
        codes.push(`${domain.code}_${i}`);
      }
    }
  }
  return codes;
}

// ── Aggregation: item → domain → level → total ──────────────────────────────
export function aggregateScores(assessmentType: string, scores: StoredScore[]) {
  const grid: GridDefinition = GRIDS[assessmentType];
  const domainResults: DomainResult[] = [];
  const levelResults: Array<{ level: number; ageRangeMonths: string; total: number; max: number; percentage: number }> = [];

  if (grid.assessmentType === 'VB_MAPP_GRID' && grid.levels) {
    for (const lvl of grid.levels) {
      let levelTotal = 0;
      let levelMax = 0;
      for (const domain of lvl.domains) {
        const items = scores.filter((s) => s.domainCode === domain.code && s.level === lvl.level);
        const total = items.reduce((sum, s) => sum + (Number(s.score) || 0), 0);
        const max = domain.totalItems * grid.maxScorePerItem;
        domainResults.push({
          code: domain.code,
          name: domain.name,
          level: lvl.level,
          total,
          max,
          percentage: max > 0 ? Math.round((total / max) * 1000) / 10 : 0,
        });
        levelTotal += total;
        levelMax += max;
      }
      levelResults.push({
        level: lvl.level,
        ageRangeMonths: lvl.ageRangeMonths,
        total: Math.round(levelTotal * 10) / 10,
        max: levelMax,
        percentage: levelMax > 0 ? Math.round((levelTotal / levelMax) * 1000) / 10 : 0,
      });
    }
  } else if (grid.assessmentType === 'ABLLS_GRID' && grid.domainsAtoZ) {
    for (const domain of grid.domainsAtoZ) {
      const items = scores.filter((s) => s.domainCode === domain.code);
      const total = items.reduce((sum, s) => sum + (Number(s.score) || 0), 0);
      const max = domain.totalItems * grid.maxScorePerItem;
      domainResults.push({
        code: domain.code,
        name: domain.name,
        level: 0,
        total,
        max,
        percentage: max > 0 ? Math.round((total / max) * 1000) / 10 : 0,
      });
    }
    const grandTotal = domainResults.reduce((s, d) => s + d.total, 0);
    const grandMax = domainResults.reduce((s, d) => s + d.max, 0);
    levelResults.push({
      level: 0,
      ageRangeMonths: 'All ages',
      total: Math.round(grandTotal * 10) / 10,
      max: grandMax,
      percentage: grandMax > 0 ? Math.round((grandTotal / grandMax) * 1000) / 10 : 0,
    });
  }

  const totalScore = domainResults.reduce((s, d) => s + d.total, 0);
  const totalMax = domainResults.reduce((s, d) => s + d.max, 0);
  const percentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 1000) / 10 : 0;

  return {
    totalScore: Math.round(totalScore * 10) / 10,
    totalMax,
    percentage,
    domainTotals: domainResults,
    levelTotals: levelResults,
  };
}

// ── Deficit detection ────────────────────────────────────────────────────────
export function detectDeficits(assessmentType: string, scores: StoredScore[]): ItemDeficit[] {
  const grid: GridDefinition = GRIDS[assessmentType];
  const deficits: ItemDeficit[] = [];
  for (const s of scores) {
    const max = grid.maxScorePerItem;
    if ((Number(s.score) || 0) < max) {
      deficits.push({
        itemCode: s.itemCode,
        domainCode: s.domainCode,
        level: s.level,
        score: s.score,
        maxScore: max,
        message: 'Item below max score. Goal generation recommended.',
      });
    }
  }
  return deficits;
}

// ── Attempt comparison + evaluation flags ────────────────────────────────────
export function evaluateAgainstPreviousAttempts(
  assessmentType: string,
  currentAttempt: number,
  currentScores: StoredScore[],
  previousAttempts: Array<{ attemptNumber: number; scores: StoredScore[] }>
): { flags: Flag[]; changeVsPrevious: number | null } {
  const flags: Flag[] = [];
  const current = aggregateScores(assessmentType, currentScores);
  const prev = previousAttempts
    .filter((a) => a.attemptNumber < currentAttempt)
    .sort((a, b) => b.attemptNumber - a.attemptNumber)[0];

  let changeVsPrevious: number | null = null;
  if (prev) {
    const prevAgg = aggregateScores(assessmentType, prev.scores);
    changeVsPrevious = Math.round((current.percentage - prevAgg.percentage) * 10) / 10;

    // Lack of progress: zero or negative trend between attempts
    if (changeVsPrevious <= 0) {
      flags.push({
        type: 'LACK_OF_PROGRESS',
        message: `Lack of progress detected: overall score changed by ${changeVsPrevious}% vs attempt ${prev.attemptNumber}. Clinical review recommended.`,
      });
    }
    // Regression: significant drop (>10 percentage points) after a previous attempt
    if (changeVsPrevious <= -10) {
      flags.push({
        type: 'REGRESSION',
        message: `Performance regression flagged: score dropped ${Math.abs(changeVsPrevious)}% vs attempt ${prev.attemptNumber}.`,
      });
    }
  }

  return { flags, changeVsPrevious };
}

// ── Goal suggestion engine: map domain deficits to goal bank ─────────────────
export function suggestGoals(
  assessmentType: string,
  scores: StoredScore[],
  domainTotals: DomainResult[],
  topN = 5
): SuggestedGoal[] {
  const grid = GRIDS[assessmentType];

  // Rank domain deficits by severity (percentage below max)
  const deficitDomains = domainTotals
    .filter((d) => d.total < d.max)
    .map((d) => ({ ...d, severity: d.max > 0 ? Math.round(((d.max - d.total) / d.max) * 100) : 0 }))
    .sort((a, b) => b.severity - a.severity);

  const suggestions: SuggestedGoal[] = [];
  const usedTargets = new Set<string>();

  for (const deficit of deficitDomains) {
    // Match goal-bank entries whose mapsToDomainCodes include this domain,
    // falling back to prefix matching for ABLLS letter domains.
    const matches: GoalBankEntry[] = GOAL_BANK.filter((g) => {
      if (!g.mapsToDomainCodes) return false;
      if (g.mapsToDomainCodes.includes(deficit.code)) return true;
      if (assessmentType === 'ABLLS_GRID' && deficit.code.startsWith('ABLLS_')) {
        return g.mapsToDomainCodes.some((c) => deficit.code === `ABLLS_${c.replace('ABLLS_', '')}` || c === deficit.code);
      }
      return false;
    });
    for (const goal of matches) {
      if (usedTargets.has(goal.targetId)) continue;
      usedTargets.add(goal.targetId);
      suggestions.push({
        targetId: goal.targetId,
        goalTitle: goal.goalTitle || goal.behaviorName || goal.targetId,
        category: goal.category,
        operationalDefinition: goal.operationalDefinition,
        measurementType: goal.measurementType,
        masteryCriteria: goal.defaultMasteryCriteria,
        reason: `${deficit.name} (${deficit.code}) at ${deficit.percentage}% — ${deficit.severity}% below max`,
        severity: deficit.severity,
      });
    }
  }

  // Also map individual deficit items (e.g. ABLLS letters) for coverage
  if (assessmentType === 'ABLLS_GRID') {
    const letterDeficits = new Set(
      scores.filter((s) => (Number(s.score) || 0) < grid.maxScorePerItem).map((s) => s.domainCode)
    );
    for (const goal of GOAL_BANK) {
      if (usedTargets.has(goal.targetId) || !goal.mapsToDomainCodes) continue;
      if (goal.mapsToDomainCodes.some((c) => letterDeficits.has(c))) {
        usedTargets.add(goal.targetId);
        suggestions.push({
          targetId: goal.targetId,
          goalTitle: goal.goalTitle || goal.behaviorName || goal.targetId,
          category: goal.category,
          operationalDefinition: goal.operationalDefinition,
          measurementType: goal.measurementType,
          masteryCriteria: goal.defaultMasteryCriteria,
          reason: 'Deficit items detected in mapped ABLLS domains',
          severity: 50,
        });
      }
    }
  }

  return suggestions.sort((a, b) => b.severity - a.severity).slice(0, topN);
}

// ── SOAP auto-draft (Objective/Assessment/Plan sections) ─────────────────────
export function generateSoapDraft(
  studentName: string,
  assessmentType: string,
  agg: ReturnType<typeof aggregateScores>,
  flags: Flag[],
  suggestedGoals: SuggestedGoal[]
): string {
  const grid = GRIDS[assessmentType];
  const lines: string[] = [];
  lines.push(`CLINICAL ASSESSMENT REPORT — ${grid.label}`);
  lines.push(`Learner: ${studentName}`);
  lines.push('');
  lines.push('OBJECTIVE');
  lines.push(`  Total score: ${agg.totalScore} / ${agg.totalMax} (${agg.percentage}%)`);
  for (const lvl of agg.levelTotals) {
    lines.push(
      `  ${lvl.level ? `Level ${lvl.level} (${lvl.ageRangeMonths} mo)` : 'Overall'}: ${lvl.total}/${lvl.max} (${lvl.percentage}%)`
    );
  }
  lines.push('');
  lines.push('DOMAIN BREAKDOWN');
  for (const d of agg.domainTotals) {
    const pct = d.percentage;
    const status = pct === 100 ? 'MASTERED' : pct >= 60 ? 'ACQUIRED' : pct > 0 ? 'EMERGING' : 'DEFICIT';
    lines.push(`  ${d.code} (${d.name}): ${d.total}/${d.max} (${pct}%) — ${status}`);
  }
  lines.push('');
  lines.push('ASSESSMENT');
  if (flags.length === 0) {
    lines.push('  No evaluation flags raised for this attempt.');
  } else {
    for (const f of flags) {
      lines.push(`  [${f.type}] ${f.message}`);
    }
  }
  lines.push('');
  lines.push('PLAN');
  if (suggestedGoals.length > 0) {
    lines.push('  Suggested targets for BCBA review (accept/modify/reject in goal panel):');
    for (const g of suggestedGoals) {
      lines.push(`  - ${g.targetId}: ${g.goalTitle} (${g.reason})`);
    }
  } else {
    lines.push('  Continue current programming; BCBA review of grid recommended.');
  }
  lines.push('');
  lines.push('Note: System outputs are recommendations. A BCBA must review and sign off.');
  return lines.join('\n');
}
