// Core application types

// Backend-aligned user types
export type UserRole = 'admin' | 'coordinator' | 'rbt' | 'client_family';
export type SessionStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
export type ScheduleEventType = 'session_created' | 'session_cancelled' | 'session_rescheduled' | 'rbt_unavailable' | 'team_created' | 'team_updated' | 'team_ended' | 'rbt_added' | 'rbt_removed' | 'primary_changed';

// Base entity interfaces
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuditableEntity extends BaseEntity {
  createdBy: string;
  updatedBy?: string;
}

// Contact and preference interfaces
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

// User interfaces
export interface User extends BaseEntity {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
}

export interface CreateUserRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  password: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  isActive?: boolean;
}

// RBT interfaces
export interface RBT extends User {
  licenseNumber: string;
  qualifications: string[];
  hourlyRate: number;
  isActive: boolean;
  hireDate: Date;
  terminationDate?: Date;
}

export interface CreateRBTRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  licenseNumber: string;
  qualifications: string[];
  hourlyRate: number;
  hireDate: Date;
}

export interface UpdateRBTRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  licenseNumber?: string;
  qualifications?: string[];
  hourlyRate?: number;
  isActive?: boolean;
  terminationDate?: Date;
}

// Client interfaces
export interface Client extends User {
  dateOfBirth: Date;
  guardianContact: ContactInfo;
  specialNeeds: string[];
  preferredSchedule: SchedulePreference[];
  isActive: boolean;
  enrollmentDate: Date;
  dischargeDate?: Date;
}

export interface CreateClientRequest {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: Date;
  guardianContact: ContactInfo;
  specialNeeds: string[];
  preferredSchedule: SchedulePreference[];
  enrollmentDate: Date;
}

export interface UpdateClientRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  guardianContact?: ContactInfo;
  specialNeeds?: string[];
  preferredSchedule?: SchedulePreference[];
  isActive?: boolean;
  dischargeDate?: Date;
}

// Session interfaces
export interface Session extends AuditableEntity {
  clientId: string;
  rbtId: string;
  startTime: Date;
  endTime: Date;
  status: SessionStatus;
  location: string;
  notes?: string;
  cancellationReason?: string;
  completionNotes?: string;
}

export interface CreateSessionRequest {
  clientId: string;
  rbtId?: string; // Optional - system can auto-assign
  startTime: Date;
  endTime: Date;
  location: string;
  createdBy: string;
}

export interface UpdateSessionRequest {
  rbtId?: string;
  startTime?: Date;
  endTime?: Date;
  status?: SessionStatus;
  location?: string;
  notes?: string;
  cancellationReason?: string;
  completionNotes?: string;
  updatedBy: string;
}

// Team interfaces
export interface Team extends AuditableEntity {
  clientId: string;
  rbtIds: string[];
  primaryRbtId: string;
  effectiveDate: Date;
  endDate?: Date;
  isActive: boolean;
}

export interface CreateTeamRequest {
  clientId: string;
  rbtIds: string[];
  primaryRbtId: string;
  effectiveDate: Date;
  createdBy: string;
}

export interface UpdateTeamRequest {
  rbtIds?: string[];
  primaryRbtId?: string;
  endDate?: Date;
  isActive?: boolean;
  updatedBy: string;
}

// Legacy UI-specific user interface for backward compatibility
export interface UIUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee' | 'client';
  avatar?: string;
  preferences: UserPreferences;
  lastLogin: Date;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  notifications: NotificationSettings;
  defaultCalendarView: 'month' | 'week' | 'day';
  timezone: string;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  scheduleChanges: boolean;
  reminders: boolean;
  systemAlerts: boolean;
}

export interface DashboardMetric {
  id: string;
  title: string;
  value: number | string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
  };
  sparklineData?: number[];
  color: 'primary' | 'success' | 'warning' | 'error';
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  type: 'session' | 'time-off' | 'meeting';
  status: 'scheduled' | 'completed' | 'cancelled' | 'rescheduled';
  participants: {
    client?: UIUser;
    rbt?: UIUser;
  };
  color: string;
  editable: boolean;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Scheduling and conflict interfaces
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

// Notification interfaces
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

// Authentication types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// WebSocket and real-time types

export interface ActivityItem {
  id: string;
  message: string;
  timestamp: Date;
  userId?: string;
  type: 'user' | 'session' | 'system';
}

// Business logic interfaces
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
  lastSessionDate?: Date;
  totalSessions: number;
  recentSessions: number; // Sessions in last 30 days
}

// Employee-specific types
export interface EmployeeSession {
  id: string;
  clientName: string;
  clientId: string;
  startTime: Date;
  endTime: Date;
  status: 'scheduled' | 'completed' | 'cancelled' | 'in-progress';
  location?: string;
  notes?: string;
  sessionType: string;
}

export interface EmployeeStats {
  sessionsThisWeek: number;
  sessionsCompleted: number;
  hoursWorked: number;
  upcomingSessions: number;
  completionRate: number;
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  reason: string;
  notes?: string;
  status: 'pending' | 'approved' | 'denied';
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
}

// Client-specific types (UI-focused)
export interface ClientChild {
  id: string;
  name: string;
  dateOfBirth: Date;
  diagnosis?: string;
  currentRBT?: UIUser;
  sessionGoals: string[];
  progressNotes?: string;
}

export interface ClientSession {
  id: string;
  childId: string;
  childName: string;
  rbtId: string;
  rbtName: string;
  startTime: Date;
  endTime: Date;
  status: 'scheduled' | 'completed' | 'cancelled' | 'in-progress';
  sessionType: string;
  location?: string;
  notes?: string;
  progressData?: {
    goalsWorkedOn: string[];
    behaviorData: any;
    parentFeedback?: string;
  };
}

export interface ClientStats {
  totalSessions: number;
  sessionsThisWeek: number;
  sessionsThisMonth: number;
  completedSessions: number;
  cancelledSessions: number;
  attendanceRate: number;
  progressScore?: number;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'admin' | 'employee' | 'client';
  recipientId: string;
  subject: string;
  content: string;
  timestamp: Date;
  read: boolean;
  threadId?: string;
  attachments?: string[];
}

export interface SessionCancellationRequest {
  sessionId: string;
  reason: string;
  notes?: string;
  requestAlternative: boolean;
  preferredTimes?: Date[];
}

export interface AdditionalSessionRequest {
  childId: string;
  sessionType: string;
  preferredDates: Date[];
  preferredTimes: string[];
  reason: string;
  notes?: string;
  urgency: 'low' | 'medium' | 'high';
}

// Team management interfaces
export interface TeamAssignment {
  teamId: string;
  rbtId: string;
  assignedDate: Date;
  removedDate?: Date;
  isPrimary: boolean;
  qualificationMatch: boolean;
}

export interface TeamHistory {
  teamId: string;
  clientId: string;
  changes: TeamChange[];
}

export interface TeamChange {
  changeDate: Date;
  changeType: 'rbt_added' | 'rbt_removed' | 'primary_changed' | 'team_created' | 'team_ended';
  rbtId?: string;
  previousPrimaryRbtId?: string;
  newPrimaryRbtId?: string;
  changedBy: string;
  reason?: string;
}

// Summary and statistics interfaces
export interface ClientScheduleSummary {
  clientId: string;
  weeklyHoursScheduled: number;
  preferredHours: number;
  schedulingEfficiency: number; // Percentage of preferred times met
  continuityScore: number; // Average continuity with assigned RBTs
}

export interface RBTAvailabilitySummary {
  rbtId: string;
  totalHoursAvailable: number;
  scheduledHours: number;
  availableHours: number;
  utilizationRate: number; // Percentage
}

export interface SessionSummary {
  sessionId: string;
  clientName: string;
  rbtName: string;
  startTime: Date;
  endTime: Date;
  status: SessionStatus;
  duration: number; // in minutes
  location: string;
}

export interface SessionConflict {
  sessionId: string;
  conflictType: 'rbt_double_booked' | 'client_double_booked' | 'outside_business_hours' | 'rbt_unavailable';
  conflictingSessionId?: string;
  description: string;
}

// Rescheduling interfaces
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

// Monitoring and metrics interfaces
export interface SystemMetrics {
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  requestsPerMinute: number;
  errorRate: number;
}

export interface ApplicationMetrics {
  totalUsers: number;
  activeUsers: number;
  totalSessions: number;
  scheduledSessions: number;
  completedSessions: number;
  cancelledSessions: number;
  averageSessionDuration: number;
  systemAlerts: number;
}

export interface AlertThreshold {
  metric: string;
  threshold: number;
  operator: 'gt' | 'lt' | 'eq';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface SystemAlert {
  id: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}
