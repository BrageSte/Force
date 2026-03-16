import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { LiveForcePanel } from '../components/test/guided/LiveForcePanel.tsx'

describe('device-aware live UI', () => {
  it('hides per-finger distribution for total-force-only devices', () => {
    const html = renderToStaticMarkup(
      <LiveForcePanel
        hand="Right"
        latestTotalKg={32}
        latestKg={null}
        tareRequired={false}
        canTare
        hasMeaningfulLoad
        perFingerForce={false}
        onTare={() => undefined}
      />,
    )

    expect(html).toContain('total force only')
    expect(html).toContain('This device provides total force only')
  })
})
