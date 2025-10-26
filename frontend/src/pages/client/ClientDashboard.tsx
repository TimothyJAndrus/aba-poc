import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Button,
} from '@mui/material';
import { Refresh } from '@mui/icons-material';
import { useClientDashboard } from '../../hooks';
import {
  ChildInfoWidget,
  UpcomingSessionsWidget,
  SessionHistorySummary,
  CommunicationCenter,
} from '../../components/client';
import { 
  useCurrentUser, 
  useSessionsByClient, 
  useUpcomingSessions,
  useRecentNotifications,
} from '../../hooks';

export const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    child: legacyChild,
    stats: legacyStats,
    upcomingSessions: legacyUpcomingSessions,
    recentSessions: legacyRecentSessions,
    messages: legacyMessages,
    unreadMessageCount: legacyUnreadMessageCount,
    loading: legacyLoading,
    error: legacyError,
    refreshData: legacyRefreshData,
  } = useClientDashboard();

  // Backend data hooks
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id;

  // Get sessions data from backend
  const { data: upcomingSessionsData, isLoading: upcomingLoading, refetch: refetchUpcoming } = useUpcomingSessions(userId, 5);
  const { data: sessionHistory, isLoading: historyLoading, refetch: refetchHistory } = useSessionsByClient(userId || '', {
    limit: 10,
  });
  const { data: notifications, isLoading: notificationsLoading, refetch: refetchNotifications } = useRecentNotifications(userId || '', 5);

  // Combine loading states
  const loading = legacyLoading || upcomingLoading || historyLoading || notificationsLoading;
  const error = legacyError;

  // Process backend data
  const child = React.useMemo(() => {
    if (!currentUser) return legacyChild;
    
    return {
      id: currentUser.id,
      name: `${currentUser.firstName} ${currentUser.lastName}`,
      dateOfBirth: new Date(), // This would come from client-specific data
      diagnosis: 'ASD', // This would come from client-specific data
      currentRBT: undefined, // This would be populated from team data
      sessionGoals: ['Improve communication skills', 'Develop social interactions', 'Reduce repetitive behaviors'],
      progressNotes: 'Making excellent progress in all areas.',
    };
  }, [currentUser, legacyChild]);

  const stats = React.useMemo(() => {
    if (!sessionHistory?.data) return legacyStats;

    const sessions = sessionHistory.data;
    const thisWeek = sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return sessionDate >= weekStart;
    });

    const thisMonth = sessions.filter(session => {
      const sessionDate = new Date(session.startTime);
      const monthStart = new Date();
      monthStart.setDate(1);
      return sessionDate >= monthStart;
    });

    const completed = sessions.filter(session => session.status === 'completed');
    const cancelled = sessions.filter(session => session.status === 'cancelled');

    return {
      totalSessions: sessions.length,
      sessionsThisWeek: thisWeek.length,
      sessionsThisMonth: thisMonth.length,
      completedSessions: completed.length,
      cancelledSessions: cancelled.length,
      attendanceRate: sessions.length > 0 ? Math.round((completed.length / sessions.length) * 100) : 0,
      progressScore: 85, // This would be calculated based on session notes and goals
    };
  }, [sessionHistory, legacyStats]);

  const upcomingSessions = React.useMemo(() => {
    if (!upcomingSessionsData?.data) return legacyUpcomingSessions;
    
    return upcomingSessionsData.data.map(session => ({
      id: session.id,
      childId: session.clientId,
      childName: child?.name || 'Your Child',
      rbtId: session.rbtId,
      rbtName: `RBT ${session.rbtId}`, // In real app, you'd join with RBT data
      startTime: new Date(session.startTime),
      endTime: new Date(session.endTime),
      status: session.status,
      sessionType: 'ABA Therapy',
      location: session.location,
      notes: session.notes,
    }));
  }, [upcomingSessionsData, child, legacyUpcomingSessions]);

  const recentSessions = React.useMemo(() => {
    if (!sessionHistory?.data) return legacyRecentSessions;
    
    return sessionHistory.data
      .filter(session => session.status === 'completed')
      .slice(0, 5)
      .map(session => ({
        id: session.id,
        childId: session.clientId,
        childName: child?.name || 'Your Child',
        rbtId: session.rbtId,
        rbtName: `RBT ${session.rbtId}`,
        startTime: new Date(session.startTime),
        endTime: new Date(session.endTime),
        status: session.status,
        sessionType: 'ABA Therapy',
        location: session.location,
        notes: session.notes,
        progressData: {
          goalsWorkedOn: ['Communication', 'Social Skills'],
          behaviorData: {},
          parentFeedback: 'Great session today!',
        },
      }));
  }, [sessionHistory, child, legacyRecentSessions]);

  const messages = React.useMemo(() => {
    if (!notifications?.data) return legacyMessages;
    
    return notifications.data.map(notification => ({
      id: notification.id,
      senderId: 'system',
      senderName: 'ABA Therapy Team',
      senderRole: 'admin' as const,
      recipientId: userId || '',
      subject: notification.subject,
      content: notification.content,
      timestamp: new Date(notification.createdAt),
      read: notification.status === 'delivered',
      threadId: notification.id,
    }));
  }, [notifications, userId, legacyMessages]);

  const unreadMessageCount = React.useMemo(() => {
    return messages.filter(message => !message.read).length;
  }, [messages]);

  const refreshData = async () => {
    try {
      await Promise.all([
        refetchUpcoming(),
        refetchHistory(),
        refetchNotifications(),
        legacyRefreshData(),
      ]);
    } catch (error) {
      console.error('Failed to refresh data:', error);
    }
  };

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
        <Button
          variant="contained"
          startIcon={<Refresh />}
          onClick={refreshData}
        >
          Try Again
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" component="h1" gutterBottom>
            Welcome back{child ? `, ${child.name}'s family` : ''}!
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Here's an overview of your child's ABA therapy progress and upcoming sessions.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={refreshData}
          disabled={loading}
        >
          {loading ? <CircularProgress size={20} /> : 'Refresh'}
        </Button>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: '1fr 2fr',
          },
          gap: 3,
          mb: 3,
        }}
      >
        {/* Child Information */}
        <ChildInfoWidget child={child} loading={loading} />

        {/* Upcoming Sessions */}
        <UpcomingSessionsWidget
          sessions={upcomingSessions}
          loading={loading}
          onViewAll={() => navigate('/client/sessions')}
        />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: '2fr 1fr',
          },
          gap: 3,
        }}
      >
        {/* Session History and Progress */}
        <SessionHistorySummary
          recentSessions={recentSessions}
          stats={stats}
          loading={loading}
          onViewHistory={() => navigate('/client/sessions')}
        />

        {/* Communication Center */}
        <CommunicationCenter
          messages={messages}
          unreadCount={unreadMessageCount}
          loading={loading}
          onSendMessage={(message) => {
            // TODO: Implement send message functionality
            console.log('Send message:', message);
          }}
          onMarkAsRead={(messageId) => {
            // TODO: Implement mark as read functionality
            console.log('Mark as read:', messageId);
          }}
          onViewAllMessages={() => {
            // TODO: Navigate to messages page
            console.log('Navigate to messages');
          }}
        />
      </Box>
    </Box>
  );
};