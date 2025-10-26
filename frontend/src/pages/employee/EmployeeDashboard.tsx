import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Grid,
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
} from '@mui/material';
import {
  Refresh,
  RequestPage,
  Schedule,
  TrendingUp,
} from '@mui/icons-material';
import { useEmployeeDashboard } from '../../hooks/useEmployeeDashboard';
import { MetricCard } from '../../components/common';
import { UpcomingSessionsWidget, PersonalScheduleCalendar } from '../../components/employee';
import { 
  useCurrentUser, 
  useSessionsByRBT, 
  useTodaysSessions, 
  useUpcomingSessions,
  useCalendarEvents,
} from '../../hooks';

export const EmployeeDashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    stats: legacyStats,
    upcomingSessions: legacyUpcomingSessions,
    todaySessions: legacyTodaySessions,
    weeklySchedule: legacyWeeklySchedule,
    loading: legacyLoading,
    error: legacyError,
    refreshData: legacyRefreshData,
  } = useEmployeeDashboard();

  // Backend data hooks
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;

  // Get sessions data from backend
  const { data: todaysSessionsData, isLoading: todaysLoading, refetch: refetchTodays } = useTodaysSessions(userId);
  const { data: upcomingSessionsData, isLoading: upcomingLoading, refetch: refetchUpcoming } = useUpcomingSessions(userId, 10);
  
  // Get calendar events for the week
  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  
  const { data: calendarEvents, isLoading: calendarLoading, refetch: refetchCalendar } = useCalendarEvents({
    startDate: startOfWeek.toISOString().split('T')[0],
    endDate: endOfWeek.toISOString().split('T')[0],
    userId,
  });

  // Get session statistics
  const { data: sessionStats, isLoading: statsLoading, refetch: refetchStats } = useSessionsByRBT(userId || '', {
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Last 30 days
    endDate: new Date().toISOString().split('T')[0],
  });

  // Combine loading states
  const loading = legacyLoading || todaysLoading || upcomingLoading || calendarLoading || statsLoading;
  const error = legacyError;

  // Process backend data
  const stats = React.useMemo(() => {
    if (!sessionStats?.data) return legacyStats;

    const sessions = sessionStats.data;
    const thisWeekStart = new Date();
    thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
    
    const sessionsThisWeek = sessions.filter(session => 
      new Date(session.startTime) >= thisWeekStart
    ).length;

    const completedSessions = sessions.filter(session => 
      session.status === 'completed'
    ).length;

    const totalHours = sessions
      .filter(session => session.status === 'completed')
      .reduce((total, session) => {
        const duration = (new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60 * 60);
        return total + duration;
      }, 0);

    const completionRate = sessions.length > 0 
      ? Math.round((completedSessions / sessions.length) * 100)
      : 0;

    return {
      sessionsThisWeek,
      sessionsCompleted: completedSessions,
      hoursWorked: Math.round(totalHours),
      upcomingSessions: upcomingSessionsData?.data?.length || 0,
      completionRate,
    };
  }, [sessionStats, upcomingSessionsData, legacyStats]);

  const todaySessions = React.useMemo(() => {
    if (!todaysSessionsData?.data) return legacyTodaySessions;
    
    return todaysSessionsData.data.map(session => ({
      id: session.id,
      clientName: `Client ${session.clientId}`, // In real app, you'd join with client data
      clientId: session.clientId,
      startTime: new Date(session.startTime),
      endTime: new Date(session.endTime),
      status: session.status,
      location: session.location,
      sessionType: 'ABA Therapy', // Default type
    }));
  }, [todaysSessionsData, legacyTodaySessions]);

  const upcomingSessions = React.useMemo(() => {
    if (!upcomingSessionsData?.data) return legacyUpcomingSessions;
    
    return upcomingSessionsData.data.map(session => ({
      id: session.id,
      clientName: `Client ${session.clientId}`,
      clientId: session.clientId,
      startTime: new Date(session.startTime),
      endTime: new Date(session.endTime),
      status: session.status,
      location: session.location,
      sessionType: 'ABA Therapy',
    }));
  }, [upcomingSessionsData, legacyUpcomingSessions]);

  const weeklySchedule = React.useMemo(() => {
    if (!calendarEvents) return legacyWeeklySchedule;
    
    return calendarEvents.map(event => ({
      id: event.id,
      title: event.title,
      start: new Date(event.start),
      end: new Date(event.end),
      type: event.type as 'session' | 'time-off' | 'meeting',
      status: event.status,
      participants: {
        client: event.clientName ? { id: '', name: event.clientName } : undefined,
        rbt: event.rbtName ? { id: '', name: event.rbtName } : undefined,
      },
      color: event.type === 'session' ? '#2563eb' : '#059669',
      editable: false,
    }));
  }, [calendarEvents, legacyWeeklySchedule]);

  const handleTimeOffRequest = () => {
    navigate('/employee/timeoff');
  };

  const handleViewAllSessions = () => {
    navigate('/employee/schedule');
  };

  const refreshData = async () => {
    try {
      await Promise.all([
        refetchTodays(),
        refetchUpcoming(),
        refetchCalendar(),
        refetchStats(),
        legacyRefreshData(),
      ]);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <Button color="inherit" size="small" onClick={refreshData}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Employee Dashboard
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<RequestPage />}
            onClick={handleTimeOffRequest}
          >
            Request Time Off
          </Button>
          <Button
            variant="outlined"
            startIcon={<Refresh />}
            onClick={refreshData}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Quick Stats Row */}
        <Grid item xs={12}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Sessions This Week"
                value={stats?.sessionsThisWeek ?? 0}
                color="primary"
                loading={loading}
                subtitle="Scheduled sessions"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Sessions Completed"
                value={stats?.sessionsCompleted ?? 0}
                color="success"
                loading={loading}
                subtitle="This month"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Hours Worked"
                value={stats?.hoursWorked ?? 0}
                color="info"
                loading={loading}
                subtitle="This week"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                title="Completion Rate"
                value={stats?.completionRate ? `${stats.completionRate}%` : '0%'}
                color={stats?.completionRate && stats.completionRate >= 90 ? 'success' : 'warning'}
                loading={loading}
                subtitle="This month"
                trend={stats?.completionRate ? {
                  direction: stats.completionRate >= 90 ? 'up' : 'stable',
                  percentage: 0,
                } : undefined}
              />
            </Grid>
          </Grid>
        </Grid>

        {/* Today's Sessions */}
        {todaySessions.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardHeader 
                title="Today's Sessions"
                avatar={<Schedule color="primary" />}
              />
              <CardContent>
                <Grid container spacing={2}>
                  {todaySessions.map((session) => (
                    <Grid item xs={12} sm={6} md={4} key={session.id}>
                      <Card variant="outlined">
                        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            {session.clientName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {new Intl.DateTimeFormat('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            }).format(session.startTime)} - {new Intl.DateTimeFormat('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true,
                            }).format(session.endTime)}
                          </Typography>
                          <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500 }}>
                            {session.sessionType}
                          </Typography>
                          {session.location && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              📍 {session.location}
                            </Typography>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Main Content Row */}
        <Grid item xs={12} lg={8}>
          <PersonalScheduleCalendar
            events={weeklySchedule}
            loading={loading}
            onEventClick={(event) => {
              console.log('Event clicked:', event);
              // TODO: Show event details modal
            }}
          />
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} lg={4}>
          <UpcomingSessionsWidget
            sessions={upcomingSessions}
            loading={loading}
            onViewAll={handleViewAllSessions}
          />
        </Grid>
      </Grid>
    </Box>
  );
};