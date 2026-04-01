-- Migración 002: hardening de sesiones activas por contexto de today

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM workout_sessions
    WHERE status = 'in_progress'
      AND plan_assignment_id IS NOT NULL
      AND training_day_id IS NOT NULL
    GROUP BY athlete_id, plan_assignment_id, training_day_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'No se puede crear uq_workout_sessions_active_today_context: existen sesiones in_progress duplicadas por athlete/assignment/training_day';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_workout_sessions_active_today_context
  ON workout_sessions (athlete_id, plan_assignment_id, training_day_id)
  WHERE status = 'in_progress'
    AND plan_assignment_id IS NOT NULL
    AND training_day_id IS NOT NULL;
