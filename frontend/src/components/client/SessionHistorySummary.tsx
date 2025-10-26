import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Button,
  LinearProgress,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  Schedule,
  TrendingUp,
} from '@mui/icons-material';
import type { ClientSession, ClientStats } from '../../types';
import { format } from 'date-fns';

interface SessionHistorySummaryProps {
  recentSessions: ClientSession[];
  stats: ClientStats | null;
  loading?: boolean;
  onViewHistory?: () => void;
}

export const SessionHistorySummary: React.FC<SessionHistorySummaryProps> = ({
  recentSessions,
  stats,
  loading = false,
  onViewHistory,
}) => {
  const getStatusIcon = (status: ClientSession['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle sx={{ color: 'success.main' }} />;
      case 'cancelled':
        return <Cancel sx={{ color: 'error.main' }} />;
      case 'scheduled':
        return <Schedule sx={{ color: 'primary.main' }} />;
      default:
        return <Schedule sx={{ color: 'grey.500' }} />;
    }
  };

  const getStatusColor = (status: ClientSession['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'scheduled':
        return 'primary';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" component="h2">
            Session Progress
          </Typography>
          {onViewHistory && (
            <Button size="small" onClick={onViewHistory}>
              View Full History
            </Button>
          )}
        </Box>

        {/* Progress Indicators */}
        {stats && (
          <Box mb={3}>
            <Box display="flex" justifyContent="space-between" mb={1}>
              <Typography variant="body2" color="text.secondary">
                Attendance Rate
              </Typography>
              <Typography variant="body2" fontWeight="medium">
                {Math.round(stats.attendanceRate)}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={stats.attendanceRate}
              sx={{ mb: 2, height: 8, borderRadius: 4 }}
            />

            <Box display="grid" gridTemplateColumns="repeat(3, 1fr)" gap={2} mb={2}>
              <Box textAlign="center">
                <Typography variant="h4" color="primary.main" fontWeight="bold">
                  {stats.sessionsThisWeek}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  This Week
                </Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h4" color="success.main" fontWeight="bold">
                  {stats.completedSessions}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Completed
                </Typography>
              </Box>
              <Box textAlign="center">
                <Typography variant="h4" color="text.primary" fontWeight="bold">
                  {stats.totalSessions}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Sessions
                </Typography>
              </Box>
            </Box>

            {stats.progressScore && (
              <Box display="flex" alignItems="center" gap={1} p={2} bgcolor="success.50" borderRadius={1}>
                <TrendingUp sx={{ color: 'success.main' }} />
                <Typography variant="body2" color="success.dark">
                  Progress Score: {stats.progressScore}% - Great improvement this month!
                </Typography>
              </Box>
            )}
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* Recent Sessions */}
        <Typography variant="subtitle2" mb={2}>
          Recent Sessions
        </Typography>

        {recentSessions.length === 0 ? (
          <Box textAlign="center" py={2}>
            <Typography variant="body2" color="text.secondary">
              No recent sessions found
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {recentSessions.slice(0, 3).map((session, index) => (
              <React.Fragment key={session.id}>
                {index > 0 && <Divider />}
                <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'transparent' }}>
                      {getStatusIcon(session.status)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="subtitle2">
                          {session.sessionType}
                        </Typography>
                        <Chip
                          label={session.status}
                          size="small"
                          color={getStatusColor(session.status)}
                          variant="outlined"
                        />
                      </Box>
                    }
                    secondary={
                      <Box mt={1}>
                        <Typography variant="body2" color="text.secondary">
                          {format(new Date(session.startTime), 'MMM dd, yyyy')} • RBT: {session.rbtName}
                        </Typography>
                        {session.notes && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            Notes: {session.notes.substring(0, 100)}
                            {session.notes.length > 100 && '...'}
                          </Typography>
                        )}
                        {session.progressData?.goalsWorkedOn && session.progressData.goalsWorkedOn.length > 0 && (
                          <Box mt={1}>
                            <Typography variant="caption" color="text.secondary">
                              Goals: {session.progressData.goalsWorkedOn.join(', ')}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              </React.Fragment>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};