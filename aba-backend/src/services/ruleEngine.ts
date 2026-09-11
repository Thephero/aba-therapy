import { prisma } from '../utils/prisma';

export interface RuleCheckResult {
  ruleId: string;
  severity: string;
  message: string;
  fieldPath?: string;
}

// MVP Rule Definitions (deterministic, no ML)
interface Rule {
  id: string;
  check: (data: RuleContext) => boolean;
  severity: string;
  messageTemplate: (data: RuleContext) => string;
  fieldPath?: string;
}

interface RuleContext {
  trial?: any;
  behavior?: any;
  session?: any;
  target?: any;
}

const RULES: Rule[] = [
  {
    id: 'rule_missing_prompt',
    severity: 'warning',
    check: (ctx) => ctx.trial?.trialType === 'DTT' && ctx.trial?.promptLevelUsed === null,
    messageTemplate: (ctx) =>
      `Target missing prompt level. Tap to record.`,
    fieldPath: 'promptLevelUsed',
  },
  {
    id: 'rule_missing_abc',
    severity: 'warning',
    check: (ctx) => !!ctx.behavior && (!ctx.behavior.antecedent || !ctx.behavior.behavior || !ctx.behavior.consequence),
    messageTemplate: () =>
      `ABC data incomplete. Please record antecedent, behavior, and consequence.`,
    fieldPath: 'behavior',
  },
  {
    id: 'rule_session_idle',
    severity: 'info',
    check: (ctx) => {
      if (!ctx.session?.startedAt || ctx.session?.status === 'COMPLETED') return false;
      const idleMinutes = (Date.now() - new Date(ctx.session.startedAt).getTime()) / 60000;
      return idleMinutes > 10;
    },
    messageTemplate: () =>
      `Session idle for over 10 minutes. Remember to record data or end the session.`,
  },
  {
    id: 'rule_prompt_fading',
    severity: 'info',
    check: (ctx) => {
      if (!ctx.trial?.promptLevelUsed) return false;
      return true; // Simplified: just remind about prompt fading opportunities
    },
    messageTemplate: (ctx) =>
      `Prompt fading opportunity available. Consider whether a less intrusive prompt is appropriate.`,
    fieldPath: 'promptLevelUsed',
  },
];

/**
 * Evaluate rules against session data.
 */
export async function evaluateRules(sessionId: string): Promise<RuleCheckResult[]> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      trials: true,
      behaviorRecords: true,
    },
  });

  if (!session) return [];

  const results: RuleCheckResult[] = [];
  const ctx: RuleContext = { session };

  // Check each trial
  for (const trial of session.trials) {
    ctx.trial = trial;
    for (const rule of RULES) {
      if ((rule.id === 'rule_missing_prompt' || rule.id === 'rule_prompt_fading') && rule.check(ctx)) {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.messageTemplate(ctx),
          fieldPath: rule.fieldPath,
        });
      }
    }
  }

  // Check each behavior record
  for (const behavior of session.behaviorRecords) {
    ctx.behavior = behavior;
    for (const rule of RULES) {
      if (rule.id === 'rule_missing_abc' && rule.check(ctx)) {
        results.push({
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.messageTemplate(ctx),
          fieldPath: rule.fieldPath,
        });
      }
    }
  }

  // Check session idle
  ctx.trial = undefined;
  ctx.behavior = undefined;
  for (const rule of RULES) {
    if (rule.id === 'rule_session_idle' && rule.check(ctx)) {
      results.push({
        ruleId: rule.id,
        severity: rule.severity,
        message: rule.messageTemplate(ctx),
      });
    }
  }

  return results;
}

/**
 * Persist alerts to the database and return them.
 * Deduplicates by not creating alerts if unresolved ones already exist for the same ruleId + sessionId.
 */
export async function checkAndSaveAlerts(sessionId: string): Promise<RuleCheckResult[]> {
  // Get session for therapistId
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { therapistId: true },
  });

  if (!session) return [];

  const alerts = await evaluateRules(sessionId);

  // Get existing unresolved alerts for this session
  const existingAlerts = await prisma.alert.findMany({
    where: { sessionId, isResolved: false },
    select: { ruleId: true },
  });
  const existingRuleIds = new Set(existingAlerts.map((a) => a.ruleId));

  // Save only new alerts (not already unresolved)
  for (const alert of alerts) {
    if (!existingRuleIds.has(alert.ruleId)) {
      await prisma.alert.create({
        data: {
          sessionId,
          therapistId: session.therapistId,
          ruleId: alert.ruleId,
          message: alert.message,
          severity: alert.severity,
          fieldPath: alert.fieldPath,
        },
      });
    }
  }

  return alerts;
}
