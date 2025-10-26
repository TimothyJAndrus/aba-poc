import { useState, useEffect } from 'react';
import { EmployeeSession, EmployeeStats, CalendarEvent } from '../types';
import { apiService } from '../services/api';

export interface UseEmployeeDashboardReturn {
  stats: EmployeeStats | null;
  upcomingSessions: EmployeeSession[];
  todaySessions: EmployeeSession[];
  weeklySchedule: CalendarEvent[];
  loading: boolean;
  error: string | null;
  refreshData: () => void;
}

export const useEmployeeDashboard = (): UseEmployeeDashboardReturn => {
  const [stats, setStats] = useState<EmployeeStats | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<EmployeeSession[]>([]);
  const [todaySessions, setTodaySessions] = useState<EmployeeSession[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEmployeeData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch employee stats
      const statsResponse = await apiService.get<EmployeeStats>('/employee/stats');
      setStats(statsResponse);

      // Fetch upcoming sessions (next 7 days)
      const upcomingResponse = await apiService.get<EmployeeSession[]>('/employee/sessions/upcoming');
      setUpcomingSessions(upcomingResponse);

      // Fetch today's sessions
      const todayResponse = await apiService.get<EmployeeSession[]>('/employee/sessions/today');
      setTodaySessions(todayResponse);

      // Fetch weekly schedule for calendar view
      const weeklyResponse = await apiService.get<CalendarEvent[]>('/employee/schedule/weekly');
      setWeeklySchedule(weeklyResponse);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch employee data');
      console.error('Error fetching employee dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  const refreshData = () => {
    fetchEmployeeData();
  };

  return {
    stats,
    upcomingSessions,
    todaySessions,
    weeklySchedule,
    loading,
    error,
    refreshData,
  };
};