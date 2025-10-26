import { useState, useEffect } from 'react';
import { ClientChild, ClientSession, ClientStats, CalendarEvent, Message } from '../types';
import { apiService } from '../services/api';

export interface UseClientDashboardReturn {
  child: ClientChild | null;
  stats: ClientStats | null;
  upcomingSessions: ClientSession[];
  recentSessions: ClientSession[];
  weeklySchedule: CalendarEvent[];
  messages: Message[];
  unreadMessageCount: number;
  loading: boolean;
  error: string | null;
  refreshData: () => void;
}

export const useClientDashboard = (): UseClientDashboardReturn => {
  const [child, setChild] = useState<ClientChild | null>(null);
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [upcomingSessions, setUpcomingSessions] = useState<ClientSession[]>([]);
  const [recentSessions, setRecentSessions] = useState<ClientSession[]>([]);
  const [weeklySchedule, setWeeklySchedule] = useState<CalendarEvent[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClientData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch child information
      const childResponse = await apiService.get<ClientChild>('/client/child');
      setChild(childResponse);

      // Fetch client stats
      const statsResponse = await apiService.get<ClientStats>('/client/stats');
      setStats(statsResponse);

      // Fetch upcoming sessions (next 7 days)
      const upcomingResponse = await apiService.get<ClientSession[]>('/client/sessions/upcoming');
      setUpcomingSessions(upcomingResponse);

      // Fetch recent sessions (last 10)
      const recentResponse = await apiService.get<ClientSession[]>('/client/sessions/recent');
      setRecentSessions(recentResponse);

      // Fetch weekly schedule for calendar view
      const weeklyResponse = await apiService.get<CalendarEvent[]>('/client/schedule/weekly');
      setWeeklySchedule(weeklyResponse);

      // Fetch messages
      const messagesResponse = await apiService.get<Message[]>('/client/messages');
      setMessages(messagesResponse);
      
      // Count unread messages
      const unreadCount = messagesResponse.filter(msg => !msg.read).length;
      setUnreadMessageCount(unreadCount);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch client data');
      console.error('Error fetching client dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, []);

  const refreshData = () => {
    fetchClientData();
  };

  return {
    child,
    stats,
    upcomingSessions,
    recentSessions,
    weeklySchedule,
    messages,
    unreadMessageCount,
    loading,
    error,
    refreshData,
  };
};