export const calendarSlotHeight = () => Math.max(60, Math.floor((window.innerHeight - 130) / 24))

export default function TimeScale({ slotHeight }: { slotHeight: number }) {
  return <div aria-hidden="true" className="calendar-time-scale">
    {Array.from({ length: 24 }, (_, hour) => <div key={hour} style={{ height: slotHeight }}><span>{String(hour).padStart(2, '0')}:00</span></div>)}
  </div>
}
