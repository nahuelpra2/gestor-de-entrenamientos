// Tipos de dominio compartidos

export type UserRole = 'coach' | 'athlete';
export type AssignmentStatus = 'active' | 'paused' | 'completed' | 'cancelled';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';
export type MeasurementSource = 'manual' | 'scale_sync' | 'coach_entered';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Coach {
  id: string;
  user_id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
}

export interface Athlete {
  id: string;
  user_id: string;
  coach_id: string;
  name: string;
  birthdate: string | null;
  avatar_url: string | null;
  timezone: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: string;
  muscle_groups: string[];
  video_url: string | null;
  instructions: string | null;
  created_by: string | null; // null = ejercicio global
}

export interface TrainingPlan {
  id: string;
  coach_id: string;
  name: string;
  description: string | null;
  total_weeks: number | null;
  cycle_weeks: number | null;
  auto_cycle: boolean;
}

export interface TrainingDay {
  id: string;
  plan_id: string;
  week_number: number;
  day_of_week: number; // 1=lunes, 7=domingo
  name: string | null;
  order_index: number;
  is_rest_day: boolean;
}

export interface PlanDayExercise {
  id: string;
  training_day_id: string;
  exercise_id: string;
  order_index: number;
  sets_target: number;
  reps_target: string;      // "8-12", "max", "30s"
  weight_target: string | null;
  rest_seconds: number | null;
  notes: string | null;
}

export interface PlanAssignment {
  id: string;
  plan_id: string;
  athlete_id: string;
  assigned_by: string;
  start_date: string;       // YYYY-MM-DD
  end_date: string | null;
  status: AssignmentStatus;
  created_at: string;
}

export interface WorkoutSession {
  id: string;
  athlete_id: string;
  plan_assignment_id: string | null;
  training_day_id: string | null;
  started_at: string;
  completed_at: string | null;
  status: SessionStatus;
  perceived_effort: number | null;
  notes: string | null;
}

export interface WorkoutLog {
  id: string;
  workout_session_id: string;
  athlete_id: string;
  exercise_id: string;
  training_day_id: string | null;
  logged_at: string;
  notes: string | null;
  deleted_at: string | null;
}

export interface WorkoutSet {
  id: string;
  workout_log_id: string;
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds: number | null;
  distance_meters: number | null;
  rpe: number | null;
  is_warmup: boolean;
  is_failure: boolean;
  notes: string | null;
}

export interface BodyMeasurement {
  id: string;
  athlete_id: string;
  measured_at: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
  muscle_mass_kg: number | null;
  notes: string | null;
  source: MeasurementSource;
}
