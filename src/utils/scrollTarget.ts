let jumping = false

export function isJumping() {
  return jumping
}

export function scrollToEventBlock(eventId: string) {
  jumping = true
  let tries = 0
  function tryScroll() {
    const el = document.getElementById(`event-${eventId}`)
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      jumping = false
    } else if (tries < 8) {
      tries++
      setTimeout(tryScroll, 100)
    } else {
      jumping = false
    }
  }
  setTimeout(tryScroll, 80)
}
