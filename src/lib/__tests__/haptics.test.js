import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// The whole point of this module is that it degrades quietly: Android has the
// Vibration API, iOS 17.4+ has the switch trick, and anything else must end up
// doing nothing at all rather than throwing inside a swipe handler.

function fakeDocument({ supportsSwitch }) {
  const clicks = []
  const el = {
    style: {}, tabIndex: 0, type: '',
    setAttribute() {}, click() { clicks.push(Date.now()) },
  }
  if (supportsSwitch) el.switch = false
  return {
    clicks,
    doc: {
      createElement: () => ({ ...el, click: el.click }),
      body: { appendChild() {} },
    },
  }
}

let mod
beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  mod = null
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('haptics', () => {
  it('uses the Vibration API when the browser has one', async () => {
    const vibrate = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { vibrate })
    vi.stubGlobal('document', fakeDocument({ supportsSwitch: false }).doc)
    mod = await import('../haptics')
    mod.tapFeedback()
    expect(vibrate).toHaveBeenCalledOnce()
  })

  it('falls back to the iOS switch when there is no Vibration API', async () => {
    const { doc, clicks } = fakeDocument({ supportsSwitch: true })
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('document', doc)
    mod = await import('../haptics')
    mod.tapFeedback()
    vi.runAllTimers()
    expect(clicks.length).toBe(1)
  })

  it('taps more than once for a success pattern', async () => {
    const { doc, clicks } = fakeDocument({ supportsSwitch: true })
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('document', doc)
    mod = await import('../haptics')
    mod.successFeedback()
    vi.runAllTimers()
    expect(clicks.length).toBeGreaterThan(1)
  })

  it('does nothing on a browser with neither, without throwing', async () => {
    const { doc, clicks } = fakeDocument({ supportsSwitch: false })
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('document', doc)
    mod = await import('../haptics')
    expect(() => { mod.tapFeedback(); mod.successFeedback() }).not.toThrow()
    vi.runAllTimers()
    expect(clicks.length).toBe(0)
  })

  it('survives a browser whose vibrate throws', async () => {
    const { doc, clicks } = fakeDocument({ supportsSwitch: true })
    vi.stubGlobal('navigator', { vibrate: () => { throw new Error('blocked') } })
    vi.stubGlobal('document', doc)
    mod = await import('../haptics')
    expect(() => mod.tapFeedback()).not.toThrow()
    vi.runAllTimers()
    expect(clicks.length).toBe(1)   // still falls through to the switch
  })
})
