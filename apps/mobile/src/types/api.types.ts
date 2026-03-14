// Tipos de respuesta de la API

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
}

// Auth
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: {
    id: string;
    email: string;
    role: 'coach' | 'athlete';
  };
}

// Today
export type TodayStatus = 'no_plan' | 'rest_day' | 'plan_completed' | 'already_done' | 'pending' | 'in_progress';

export interface TrainingDayExercise {
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
}

export interface TrainingDay {
  id: string;
  week_number: number;
  day_of_week: number;
  name: string | null;
  exercises: TrainingDayExercise[];
}

export interface WorkoutSession {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  perceived_effort: number | null;
}

export type TodayResponse =
  | { status: 'no_plan' }
  | { status: 'rest_day'; next_training_day: { id: string; name: string | null; days_away: number } }
  | { status: 'plan_completed'; summary: unknown }
  | { status: 'already_done'; session: WorkoutSession }
  | { status: 'pending'; training_day: TrainingDay; session: null }
  | { status: 'in_progress'; training_day: TrainingDay; session: WorkoutSession };

// Logs
export interface SetInput {
  set_number: number;
  weight_kg: number | null;
  reps: number | null;
  duration_seconds?: number;
  rpe?: number;
  is_warmup?: boolean;
  is_failure?: boolean;
  notes?: string;
}

export interface CreateLogDto {
  session_id: string;
  exercise_id: string;
  logged_at: string;
  notes?: string;
  sets: SetInput[];
}

export interface WorkoutLog {
  id: string;
  session_id: string;
  exercise_id: string;
  logged_at: string;
  total_volume: number;
  sets: SetInput[];
}
