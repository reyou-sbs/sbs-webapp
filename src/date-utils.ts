export function todayISO() { return new Date().toISOString().slice(0,10) }
export function ymd(date: Date) { return date.toISOString().slice(0,10) }
export function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return ymd(d)
}
export function monthEnd(iso: string) {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth()+1, 0)
  return ymd(d)
}
export function toSpecificDayNextOrSame(iso: string, day: number) {
  const d = new Date(iso + 'T00:00:00Z')
  const curDay = d.getUTCDate()
  if (curDay <= day) {
    d.setUTCDate(day)
    return ymd(d)
  }
  d.setUTCMonth(d.getUTCMonth()+1, day)
  return ymd(d)
}
