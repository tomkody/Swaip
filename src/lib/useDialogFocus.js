import { useEffect, useRef } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Keyboard contract for a dialog or drawer: focus moves inside when it opens,
// Tab cycles within it, Escape closes it, and focus goes back to whatever
// opened it when it closes (or to `fallbackFocus` if the opener is gone —
// e.g. the swipe button that triggered a match modal has been unmounted).
export function useDialogFocus(ref, { open = true, onClose, fallbackFocus } = {}) {
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    if (!open) return
    const node = ref.current
    if (!node) return
    const opener = document.activeElement
    const focusables = () => [...node.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null)
    ;(focusables()[0] || node).focus({ preventScroll: true })

    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); closeRef.current?.(); return }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const i = items.indexOf(document.activeElement)
      if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus() }
      else if (!e.shiftKey && (i === -1 || i === items.length - 1)) { e.preventDefault(); items[0].focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      const back = opener && opener.isConnected && opener !== document.body
        ? opener
        : (fallbackFocus ? document.querySelector(fallbackFocus) : null)
      back?.focus?.({ preventScroll: true })
    }
  }, [ref, open, fallbackFocus])
}
