import test from 'node:test'
import assert from 'node:assert/strict'
import { planAuthSecrets } from '../scripts/auth-secret-plan.mjs'

test('authorization bootstrap generates a state key once and preserves existing secrets on redeploy', () => {
  const first = planAuthSecrets({})
  assert.match(first.AUTH_STATE_SECRET, /^[a-f0-9]{64}$/)
  assert.notEqual(first.AUTH_STATE_SECRET, planAuthSecrets({}).AUTH_STATE_SECRET)
  assert.deepEqual(planAuthSecrets({}, ['AUTH_STATE_SECRET', 'GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET']), {})
  assert.deepEqual(planAuthSecrets({ GITHUB_CLIENT_ID: 'public-id', GITHUB_CLIENT_SECRET: 'synthetic-secret' }, ['AUTH_STATE_SECRET']), { GITHUB_CLIENT_ID: 'public-id', GITHUB_CLIENT_SECRET: 'synthetic-secret' })
  assert.throws(() => planAuthSecrets({ GITHUB_CLIENT_ID: 'public-id' }), /成对/)
  assert.throws(() => planAuthSecrets({ AUTH_STATE_SECRET: 'short' }), /32/)
})
