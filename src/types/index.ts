// Core type definitions for the ABA Scheduling System

export type UserRole = 'admin' | 'coordinator' | 'rbt' | 'client_family';

export type SessionStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export type ScheduleEventType = 'session_created' | 'session_cancelled' | 'session_rescheduled' | 'rbt_unavailable' | 'team_created' | 'team_updated' | 'team_ended' | 'rbt_added' | 'rbt_removed' | 'primary_changed';

export interface ContactInfo {
  email: string;
  phone: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
}

export interface SchedulePreference {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  preferredStartTime: string; // HH:MM format
  preferredEndTime: string; // HH:MM format
  priority: number; // 1-5, with 1 being highest priority
}

export interface BusinessHours {
  startTime: string; // "09:00"
  endTime: string; // "19:00"
  validDays: number[]; // [1, 2, 3, 4, 5] for Monday-Friday
}

export interface SchedulingConstraints {
  businessHours: BusinessHours;
  sessionDuration: number; // Duration in hours (3 for ABA sessions)
  maxSessionsPerDay: number;
  minBreakBetweenSessions: number; // Minutes
}

export interface ContinuityScore {
  rbtId: string;
  clientId: string;
  score: number; // 0-100, higher is better
  lastSessionDate?: Date | undefined;
  totalSessions: number;
  recentSessions: number; // Sessions in last 30 days
}

export interface SchedulingResult {
  success: boolean;
  sessionId?: string;
  conflicts?: SchedulingConflict[];
  alternatives?: AlternativeOption[];
  message?: string;
}

export interface SchedulingConflict {
  type: 'rbt_unavailable' | 'client_unavailable' | 'time_conflict' | 'business_hours_violation';
  description: string;
  conflictingSessionId?: string;
  suggestedResolution?: string;
}

export interface AlternativeOption {
  rbtId: string;
  startTime: Date;
  endTime: Date;
  continuityScore: number;
  availability: 'available' | 'preferred' | 'possible';
}

export interface ReschedulingOptions {
  sessionId: string;
  reason: string;
  alternatives: AlternativeOption[];
  notificationPreferences: NotificationPreference[];
}

export interface NotificationPreference {
  userId: string;
  channels: ('email' | 'sms' | 'push')[];
  timing: {
    immediate: boolean;
    reminder24h: boolean;
    reminder2h: boolean;
  };
}

export type NotificationType = 
  | 'session_scheduled'
  | 'session_cancelled' 
  | 'session_rescheduled'
  | 'session_reminder'
  | 'rbt_assignment_changed'
  | 'team_updated'
  | 'system_alert';

export type NotificationChannel = 'email' | 'sms' | 'push';

export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'cancelled';

export interface NotificationData {
  id: string;
  type: NotificationType;
  recipientId: string;
  recipientEmail?: string;
  recipientPhone?: string;
  channel: NotificationChannel;
  subject: string;
  content: string;
  templateData?: Record<string, any>;
  scheduledFor?: Date;
  status: NotificationStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  deliveredAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationTemplate {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject: string;
  content: string;
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueJobData {
  notificationId: string;
  type: NotificationType;
  recipientId: string;
  channel: NotificationChannel;
  templateData: Record<string, any>;
  scheduledFor?: Date;
}

// Database entity interfaces
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditableEntity extends BaseEntity {
  createdBy: string;
  updatedBy?: string;
}