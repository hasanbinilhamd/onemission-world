import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProfitAllocationRecordScope,
  getProfitAllocationRecordScopeKey,
  validateAllocationReduction,
} from '../lib/profit-allocation/hardening.js';

function sumRecordsForScope(records, periodKey, policyId) {
  const scope = buildProfitAllocationRecordScope(periodKey, policyId);
  return records
    .filter((record) => record.periodKey === scope.periodKey && record.policyId === scope.policyId)
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);
}

test('profit allocation execution aggregation is isolated by period and policy', () => {
  const records = [
    { periodKey: '2026-08', policyId: 'policy-a', allocationName: 'Marketing', amount: 500000 },
    { periodKey: '2026-08', policyId: 'policy-b', allocationName: 'Marketing', amount: 0 },
  ];

  assert.equal(sumRecordsForScope(records, '2026-08', 'policy-a'), 500000);
  assert.equal(sumRecordsForScope(records, '2026-08', 'policy-b'), 0);
});

test('profit allocation adjustment aggregation is isolated by period and policy', () => {
  const records = [
    { periodKey: '2026-08', policyId: 'policy-a', sourceAllocationName: 'Operational', destinationAllocationName: 'Marketing', amount: 200000 },
  ];

  assert.equal(sumRecordsForScope(records, '2026-08', 'policy-a'), 200000);
  assert.equal(sumRecordsForScope(records, '2026-08', 'policy-b'), 0);
  assert.equal(getProfitAllocationRecordScopeKey('2026-08', 'policy-a'), '2026-08:policy-a');
});

test('allocation can be reduced to its already executed amount', () => {
  const result = validateAllocationReduction({
    adjustedTargetAmount: 1000000,
    executedAmount: 800000,
    reductionAmount: 200000,
  });

  assert.equal(result.valid, true);
});

test('allocation cannot be reduced below its already executed amount', () => {
  const result = validateAllocationReduction({
    adjustedTargetAmount: 1000000,
    executedAmount: 800000,
    reductionAmount: 200001,
  });

  assert.equal(result.valid, false);
  assert.equal(result.message, 'This allocation cannot be reduced below its already executed amount.');
});

test('allocation reduction validation uses total executed amount', () => {
  const executions = [500000, 300000];
  const result = validateAllocationReduction({
    adjustedTargetAmount: 1000000,
    executedAmount: executions.reduce((sum, amount) => sum + amount, 0),
    reductionAmount: 300000,
  });

  assert.equal(result.valid, false);
});
