// Contratos de request/response de la API

import {
  WorkoutSet,
  AssignmentStatus,
} from './domain';

// --- Respuestas genéricas ---

export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    cursor: string | null;
    has_more: boolean;
    count: number;
  };
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  path?: string;
  timestamp?: string;
}

// --- Auth ---

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponseData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    role: 'coach' | 'athlete';
  };
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

// --- Today ---

export type TodayStatus =
  | 'no_plan'
  | 'rest_day'
  | 'plan_completed'
  | 'already_done'
  | 'pending'
  | 'in_progress';

export interface TrainingDayWithExercises {
  id: string;
  week_number: number;
  day_of_week: number;
  name: string | null;
  exercises: Array<{
    id: string;
    order_index: number;
    sets_target: number;
    reps_target: string;
    weight_target: string | null;
    rest_seconds: number | null;
    notes: string | null;
    exercise: {
      id: string;
      name: string;
      category: string;
      muscle_groups: string[];
      video_url: string | null;
      instructions: string | null;
    };
  }>;
}

export type TodayResponseData =
  | { status: 'no_plan' }
  | { status: 'rest_day'; next_training_day: { id: string; name: string | null; days_away: number } }
  | { status: 'plan_completed'; summary: unknown }
  | { status: 'already_done'; session: SessionData }
  | { status: 'pending'; training_day: TrainingDayWithExercises; session: null }
  | { status: 'in_progress'; training_day: TrainingDayWithExercises; session: SessionData };

export interface SessionData {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  perceived_effort: number | null;
}

// --- Plans ---

export interface CreatePlanRequest {
  name: string;
  description?: string;
  total_weeks?: number;
  cycle_weeks?: number;
  auto_cycle?: boolean;
}

export interface CreateAssignmentRequest {
  athlete_id: string;
  start_date: string; // YYYY-MM-DD
}

export interface UpdateAssignmentRequest {
  status?: AssignmentStatus;
  end_date?: string;
}

// --- Sessions ---

export interface CreateSessionRequest {
  training_day_id?: string;
  plan_assignment_id?: string;
}

export interface CompleteSessionRequest {
  perceived_effort?: number; // 1-10
  notes?: string;
}

// --- Logs ---

export interface SetInput {
  set_number: number;
  weight_kg?: number;
  reps?: number;
  duration_seconds?: number;
  distance_meters?: number;
  rpe?: number;
  is_warmup?: boolean;
  is_failure?: boolean;
  notes?: string;
}

export interface CreateLogRequest {
  session_id: string;
  exercise_id: string;
  logged_at: string; // ISO8601
  notes?: string;
  sets: SetInput[];
}

export interface UpdateLogRequest {
  client_updated_at: string; // ISO8601 — para conflict detection
  notes?: string;
  sets?: SetInput[];
}

export interface WorkoutLogWithSets {
  id: string;
  session_id: string;
  exercise_id: string;
  logged_at: string;
  total_volume: number;
  notes: string | null;
  sets: WorkoutSet[];
}

// --- Measurements ---

export interface CreateMeasurementRequest {
  measured_at?: string; // ISO8601, default: now
  weight_kg?: number;
  body_fat_pct?: number;
  muscle_mass_kg?: number;
  notes?: string;
}

// --- Exercises ---

export interface ExerciseSearchParams {
  search?: string;
  category?: string;
  muscle_group?: string;
  cursor?: string;
  limit?: number;
}

// --- Logs history ---

export interface LogsHistoryParams {
  exercise_id?: string;
  session_id?: string;
  training_day_id?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
  include_sets?: boolean;
}
