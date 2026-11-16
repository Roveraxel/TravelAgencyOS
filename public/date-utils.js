/**
 * Utilitare de dată pentru termene de follow-up, scadențe rezervări și sarcini.
 */

export function getTodayIso(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returnează starea unui termen YYYY-MM-DD față de data curentă:
 * - 'none'    : fără dată
 * - 'overdue' : înainte de azi
 * - 'today'   : azi
 * - 'soon'    : în următoarele 3 zile
 * - 'ok'      : mai departe de 3 zile
 */
export function getDueStatus(isoDate, todayIso = getTodayIso()) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    return 'none';
  }
  if (isoDate < todayIso) return 'overdue';
  if (isoDate === todayIso) return 'today';

  const target = new Date(`${isoDate}T00:00:00Z`).getTime();
  const today = new Date(`${todayIso}T00:00:00Z`).getTime();
  const diffDays = Math.round((target - today) / 86_400_000);
  if (diffDays <= 3) return 'soon';
  return 'ok';
}

export function getDueLabel(status) {
  switch (status) {
    case 'overdue':
      return 'Restant';
    case 'today':
      return 'Azi';
    case 'soon':
      return 'În curând';
    default:
      return '';
  }
}
