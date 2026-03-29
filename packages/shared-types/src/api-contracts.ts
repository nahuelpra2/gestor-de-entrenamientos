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

export interface TodayExerciseData {
  id: string;
  name: string;
  category: string;
  muscleGroups: string[];
  videoUrl: string | null;
  instructions: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TodayPlanDayExercise {
  id: string;
  trainingDayId: string;
  exerciseId: string;
  orderIndex: number;
  setsTarget: number;
  repsTarget: string;
  weightTarget: string | null;
  restSeconds: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  exercise: TodayExerciseData;
}

export interface TodayTrainingDay {
  id: string;
  planId: string;
  weekNumber: number;
  dayOfWeek: number;
  name: string | null;
  orderIndex: number;
  isRestDay: boolean;
  createdAt: string;
}

export interface TodayTrainingDayWithExercises extends TodayTrainingDay {
  exercises: TodayPlanDayExercise[];
}

export type TodayResponseData =
  | { status: 'no_plan'; startsAt?: string }
  | { status: 'rest_day'; nextTrainingDay: TodayTrainingDay | null }
  | { status: 'plan_completed'; assignmentId: string }
  | { status: 'already_done'; session: SessionData }
  | { status: 'pending'; trainingDay: TodayTrainingDayWithExercises; session: null }
  | { status: 'in_progress'; trainingDay: TodayTrainingDayWithExercises; session: SessionData };

export interface SessionData {
  id: string;
  athleteId: string;
  planAssignmentId: string | null;
  trainingDayId: string | null;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  perceivedEffort: number | null;
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
