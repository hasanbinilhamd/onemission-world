const FLOAT_TOLERANCE = 0.009;

export function buildProfitAllocationRecordScope(periodKey, policyId) {
  return {
    periodKey: String(periodKey || '').trim(),
    policyId: String(policyId || '').trim(),
  };
}

export function getProfitAllocationRecordScopeKey(periodKey, policyId) {
  const scope = buildProfitAllocationRecordScope(periodKey, policyId);
  return `${scope.periodKey}:${scope.policyId}`;
}

export function validateAllocationReduction({ adjustedTargetAmount = 0, executedAmount = 0, reductionAmount = 0 } = {}) {
  const currentTarget = Number(adjustedTargetAmount || 0);
  const alreadyExecuted = Number(executedAmount || 0);
  const reduction = Number(reductionAmount || 0);

  if (!Number.isFinite(reduction) || reduction <= 0) {
    return { valid: false, message: 'Adjustment amount must be greater than 0.' };
  }

  if (currentTarget - reduction < alreadyExecuted - FLOAT_TOLERANCE) {
    return {
      valid: false,
      message: 'This allocation cannot be reduced below its already executed amount.',
    };
  }

  return { valid: true, message: '' };
}
