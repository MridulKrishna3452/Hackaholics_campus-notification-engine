import { StepTypeEnum } from '@novu/shared';

/** Step types that deliver something to a person. Trigger/digest/delay/http/throttle/custom steps are never held. */
export const FOCUS_HELD_STEP_TYPES: ReadonlySet<StepTypeEnum | string> = new Set([
  StepTypeEnum.IN_APP,
  StepTypeEnum.EMAIL,
  StepTypeEnum.SMS,
  StepTypeEnum.PUSH,
  StepTypeEnum.CHAT,
]);

export type FocusCriticalRules = {
  /** Workflow trigger identifiers that must always get through. */
  criticalWorkflowIdentifiers: string[];
  /** Workflow tags that must always get through. */
  criticalTags: string[];
};

export type FocusCriticalReason = 'workflow_critical_flag' | 'identifier_allowlist' | 'tag_allowlist';

export type FocusClassification = { critical: true; reason: FocusCriticalReason } | { critical: false };

const splitList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);

/**
 * Rules come from configuration, never from guesswork:
 *   FOCUS_MODE_CRITICAL_WORKFLOW_IDS=exam-alert,emergency-notice
 *   FOCUS_MODE_CRITICAL_TAGS=critical,safety
 * A workflow whose own `critical` flag is true is always critical (same flag the schedule logic already honours).
 */
export function parseFocusCriticalRules(env: Record<string, string | undefined> = process.env): FocusCriticalRules {
  return {
    criticalWorkflowIdentifiers: splitList(env.FOCUS_MODE_CRITICAL_WORKFLOW_IDS),
    criticalTags: splitList(env.FOCUS_MODE_CRITICAL_TAGS),
  };
}

/**
 * Pure and explicit. Anything that matches no rule is NON-critical (held). It never infers urgency
 * from message text, payload contents or channel.
 */
export function classifyForFocusMode(
  input: { workflowCritical?: boolean; workflowIdentifier?: string; workflowTags?: string[] },
  rules: FocusCriticalRules
): FocusClassification {
  if (input.workflowCritical === true) {
    return { critical: true, reason: 'workflow_critical_flag' };
  }

  if (input.workflowIdentifier && rules.criticalWorkflowIdentifiers.includes(input.workflowIdentifier)) {
    return { critical: true, reason: 'identifier_allowlist' };
  }

  if (input.workflowTags?.some((tag) => rules.criticalTags.includes(tag))) {
    return { critical: true, reason: 'tag_allowlist' };
  }

  return { critical: false };
}

export const ENTITY_KEY_MAX_LENGTH = 200;

/**
 * Correlation key supplied by whoever triggers the event: `payload.entityKey`, e.g. "course:CS101" or
 * "assignment:42". Missing/invalid => undefined (the notification is NOT merged with any other).
 */
export function extractEntityKey(payload: unknown): string | undefined {
  const raw = (payload as { entityKey?: unknown } | undefined | null)?.entityKey;
  if (typeof raw !== 'string') return undefined;

  const key = raw.trim();
  if (key.length === 0 || key.length > ENTITY_KEY_MAX_LENGTH) return undefined;

  return key;
}
