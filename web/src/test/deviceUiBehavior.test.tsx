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
        verificationBlocked={false}
        verificationReason={null}
        onTare={() => undefined}
      />,
    )

    expect(html).toContain('total force only')
    expect(html).toContain('This device provides total force only')
  })

  it('shows a verification block placeholder when live force is hidden', () => {
    const html = renderToStaticMarkup(
      <LiveForcePanel
        hand="Right"
        latestTotalKg={32}
        latestKg={[8, 8, 8, 8]}
        tareRequired={false}
        canTare
        hasMeaningfulLoad
        perFingerForce
        verificationBlocked
        verificationReason="Waiting for firmware to confirm KG mode."
        onTare={() => undefined}
      />,
    )

    expect(html).toContain('Live force is hidden')
    expect(html).toContain('Waiting for firmware to confirm KG mode.')
  })
})
