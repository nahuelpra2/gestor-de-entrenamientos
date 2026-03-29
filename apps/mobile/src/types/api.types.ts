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

export interface TodayExercise {
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

export interface TrainingDayExercise {
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
  exercise: TodayExercise;
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

export interface TrainingDay extends TodayTrainingDay {
  exercises: TrainingDayExercise[];
}

export interface WorkoutSession {
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

export type TodayResponse =
  | { status: 'no_plan'; startsAt?: string }
  | { status: 'rest_day'; nextTrainingDay: TodayTrainingDay | null }
  | { status: 'plan_completed'; assignmentId: string }
  | { status: 'already_done'; session: WorkoutSession }
  | { status: 'pending'; trainingDay: TrainingDay; session: null }
  | { status: 'in_progress'; trainingDay: TrainingDay; session: WorkoutSession };

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
