/**
 * Lógica del algoritmo "día de hoy".
 * Esta lógica debe ser consistente con el backend (apps/api).
 * Ver docs/ALGORITHMS.md para la especificación completa.
 */

/**
 * Calcula la semana actual dentro del plan, dado el start_date de la asignación.
 *
 * @param startDate - Fecha de inicio del plan (YYYY-MM-DD)
 * @param today - Fecha actual (default: hoy)
 * @param totalWeeks - Total de semanas del plan (null = sin fin)
 * @param cycleWeeks - Semanas del ciclo que se repite (null = no cicla)
 * @param autoCycle - Si el plan cicla automáticamente al terminar
 */
export function calculateCurrentWeek(params: {
  startDate: string;
  today?: Date;
  totalWeeks: number | null;
  cycleWeeks: number | null;
  autoCycle: boolean;
}): { weekNumber: number; isPlanCompleted: boolean } {
  const { startDate, totalWeeks, cycleWeeks, autoCycle } = params;
  const today = params.today ?? new Date();

  const start = new Date(startDate);
  // Normalizar a medianoche UTC para evitar problemas de timezone
  start.setUTCHours(0, 0, 0, 0);
  const todayNormalized = new Date(today);
  todayNormalized.setUTCHours(0, 0, 0, 0);

  const daysSinceStart = Math.floor(
    (todayNormalized.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysSinceStart < 0) {
    // El plan comienza en el futuro
    return { weekNumber: 0, isPlanCompleted: false };
  }

  let weekNumber = Math.floor(daysSinceStart / 7) + 1;

  if (totalWeeks !== null && weekNumber > totalWeeks) {
    if (autoCycle && cycleWeeks !== null) {
      weekNumber = ((weekNumber - 1) % cycleWeeks) + 1;
      return { weekNumber, isPlanCompleted: false };
    }
    return { weekNumber: totalWeeks, isPlanCompleted: true };
  }

  return { weekNumber, isPlanCompleted: false };
}

/**
 * Retorna el día de la semana ISO de una fecha.
 * 1 = lunes, 7 = domingo
 */
export function getISODayOfWeek(date?: Date): number {
  const d = date ?? new Date();
  const day = d.getDay(); // 0 = domingo, 1 = lunes, ..., 6 = sábado
  return day === 0 ? 7 : day;
}
