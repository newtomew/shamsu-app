// validation.ts — basic shape-checking for a submitted recording, with
// friendly (non-throwing) error messages. Deliberately lenient: it checks
// structure, not recording quality — a flow with only network_requests (no
// steps) or vice versa is fine, it just needs at least one non-empty side.

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateRecordingInput(name: unknown, recordedFlow: unknown): ValidationResult {
  if (typeof name !== 'string' || !name.trim()) {
    return { valid: false, error: 'name is required and must be a non-empty string.' };
  }
  if (name.length > 255) {
    return { valid: false, error: 'name must be 255 characters or fewer.' };
  }

  if (!recordedFlow || typeof recordedFlow !== 'object' || Array.isArray(recordedFlow)) {
    return { valid: false, error: 'recorded_flow is required and must be an object.' };
  }
  const flow = recordedFlow as Record<string, unknown>;
  const steps = flow.steps;
  const networkRequests = flow.network_requests;

  if (steps !== undefined && !Array.isArray(steps)) {
    return { valid: false, error: 'recorded_flow.steps must be an array if present.' };
  }
  if (networkRequests !== undefined && !Array.isArray(networkRequests)) {
    return { valid: false, error: 'recorded_flow.network_requests must be an array if present.' };
  }

  const hasSteps = Array.isArray(steps) && steps.length > 0;
  const hasRequests = Array.isArray(networkRequests) && networkRequests.length > 0;
  if (!hasSteps && !hasRequests) {
    return {
      valid: false,
      error: 'recorded_flow has no steps or network_requests — nothing was captured during recording.',
    };
  }

  if (hasSteps) {
    const stepsArr = steps as unknown[];
    for (let i = 0; i < stepsArr.length; i++) {
      const step = stepsArr[i];
      if (!step || typeof step !== 'object' || typeof (step as Record<string, unknown>).type !== 'string') {
        return { valid: false, error: `recorded_flow.steps[${i}] is missing a string "type" field.` };
      }
    }
  }
  if (hasRequests) {
    const requestsArr = networkRequests as unknown[];
    for (let i = 0; i < requestsArr.length; i++) {
      const r = requestsArr[i];
      if (!r || typeof r !== 'object' || typeof (r as Record<string, unknown>).url !== 'string') {
        return { valid: false, error: `recorded_flow.network_requests[${i}] is missing a string "url" field.` };
      }
    }
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// Confirmation-time validation (Phase 5) — checks the choices a creator makes
// on the confirm screen (replay_mode, credential_type, variables, output
// fields) for hard errors (malformed data — always blocks) and warnings
// (ambiguous/contradictory choices that PRD section 1.3 says must be flagged
// before confirm, but can be overridden with `force: true`).
// ---------------------------------------------------------------------------

export const VALID_REPLAY_MODES = ['network_replay', 'hybrid', 'browser_replay'];
export const VALID_CREDENTIAL_TYPES = ['stored', 'caller-provided', 'prompt-on-call'];

export interface ConfirmVariableInput {
  name: string;
  source?: string;
}

export interface ConfirmOutputFieldInput {
  name: string;
  path: string;
}

export interface ConfirmChoices {
  needs_login: boolean;
  replay_mode: string;
  credential_type: string;
  variables: ConfirmVariableInput[];
  output_fields: ConfirmOutputFieldInput[];
}

export interface ConfirmValidation {
  error?: string; // hard failure — blocks regardless of force
  warnings: string[]; // soft — blocks unless the request sets force: true
}

export function validateConfirmationChoices(input: ConfirmChoices): ConfirmValidation {
  const warnings: string[] = [];

  if (!VALID_REPLAY_MODES.includes(input.replay_mode)) {
    return { error: `replay_mode must be one of: ${VALID_REPLAY_MODES.join(', ')}`, warnings };
  }
  if (!VALID_CREDENTIAL_TYPES.includes(input.credential_type)) {
    return { error: `credential_type must be one of: ${VALID_CREDENTIAL_TYPES.join(', ')}`, warnings };
  }

  const seenVarNames = new Set<string>();
  for (const v of input.variables) {
    if (!v.name || !v.name.trim()) {
      return { error: 'Every variable needs a non-empty name.', warnings };
    }
    if (seenVarNames.has(v.name)) {
      return { error: `Duplicate variable name: "${v.name}".`, warnings };
    }
    seenVarNames.add(v.name);
  }

  const seenFieldNames = new Set<string>();
  for (const f of input.output_fields) {
    if (!f.name || !f.name.trim()) {
      return { error: 'Every output field needs a non-empty name.', warnings };
    }
    if (!f.path || !f.path.trim()) {
      return { error: `Output field "${f.name}" needs a JSON path (e.g. ".name").`, warnings };
    }
    if (seenFieldNames.has(f.name)) {
      return { error: `Duplicate output field name: "${f.name}".`, warnings };
    }
    seenFieldNames.add(f.name);
  }

  // The replay engine's network_replay path never launches a browser (see
  // replay.ts) — it cannot perform a login. If the recording needs a login,
  // this combination will fail at call time.
  if (input.needs_login && input.replay_mode === 'network_replay') {
    warnings.push(
      'This recording appears to require a login, but "network_replay" never runs a browser and cannot log in — calls will likely fail. Choose "hybrid" or "browser_replay" instead, or confirm anyway if you are sure no login is actually needed.'
    );
  }

  for (const v of input.variables) {
    if (v.source && /password|passwd|pwd/i.test(v.source)) {
      warnings.push(
        `"${v.name}" looks like a password field but is marked as a caller-editable variable — every caller would need to supply your password. Consider removing it, or use credential_type instead.`
      );
    }
  }

  return { warnings };
}
