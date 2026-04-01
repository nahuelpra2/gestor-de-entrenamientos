export interface ApiEnvelope<T> {
  data: T;
}

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

export interface TodayTrainingDayWithExercises extends TodayTrainingDay {
  exercises: TrainingDayExercise[];
}

export type WorkoutSessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface WorkoutSession {
  id: string;
  athleteId: string;
  planAssignmentId: string | null;
  trainingDayId: string | null;
  startedAt: string;
  completedAt: string | null;
  notes: string | null;
  status: WorkoutSessionStatus;
  perceivedEffort: number | null;
}

export type TodayResponse =
  | { status: 'no_plan'; startsAt?: string }
  | { status: 'rest_day'; nextTrainingDay: TodayTrainingDay | null }
  | { status: 'plan_completed'; assignmentId: string }
  | { status: 'already_done'; assignmentId: string; session: WorkoutSession }
  | { status: 'pending'; assignmentId: string; trainingDay: TodayTrainingDayWithExercises; session: null }
  | { status: 'in_progress'; assignmentId: string; trainingDay: TodayTrainingDayWithExercises; session: WorkoutSession };

export interface CreateSessionInput {
  planAssignmentId: string;
  trainingDayId: string;
  startedAt?: string;
  notes?: string;
}

export interface CompleteSessionInput {
  perceivedEffort?: number;
  notes?: string;
  completedAt?: string;
}

export interface SessionConflictResolution {
  resumed: boolean;
  today: TodayResponse;
}
