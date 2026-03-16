import { describe, expect, it } from 'vitest'
import { getProtocolById } from '../components/test/testLibrary.ts'
import { capabilityBlockReason, supportsCapabilityRequirements } from '../device/capabilityChecks.ts'
import { defaultConnectedDevice } from '../device/deviceProfiles.ts'

describe('capability gating', () => {
  it('allows total-force protocols on Tindeq and blocks per-finger protocols', () => {
    const tindeqCapabilities = defaultConnectedDevice('Tindeq').capabilities

    expect(supportsCapabilityRequirements(getProtocolById('standard_max').capabilityRequirements, tindeqCapabilities)).toBe(true)
    expect(supportsCapabilityRequirements(getProtocolById('distribution_hold').capabilityRequirements, tindeqCapabilities)).toBe(false)
    expect(capabilityBlockReason(getProtocolById('distribution_hold').capabilityRequirements, tindeqCapabilities))
      .toContain('per-finger force data')
  })
})
