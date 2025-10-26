import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  Box,
  Chip,
  Divider,
  Button,
} from '@mui/material';
import {
  Person,
  Schedule,
  LocationOn,
  ChevronRight,
} from '@mui/icons-material';
import type { EmployeeSession } from '../../types';

interface UpcomingSessionsWidgetProps {
  sessions: EmployeeSession[];
  loading?: boolean;
  onViewAll?: () => void;
}

const getStatusColor = (status: EmployeeSession['status']) => {
  switch (status) {
    case 'scheduled':
      return 'primary';
    case 'in-progress':
      return 'warning';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'error';
    default:
      return 'default';
  }
};

const formatTime = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

const formatDate = (date: Date) => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  if (date.toDateString() === today.toDateString()) {
    return 'Today';
  } else if (date.toDateString() === tomorrow.toDateString()) {
    return 'Tomorrow';
  } else {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(date);
  }
};

export const UpcomingSessionsWidget: React.FC<UpcomingSessionsWidgetProps> = ({
  sessions,
  loading = false,
  onViewAll,
}) => {
  if (loading) {
    return (
      <Card>
        <CardHeader title="Upcoming Sessions" />
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Loading sessions...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (sessions.length === 0) {
    return (
      <Card>
        <CardHeader title="Upcoming Sessions" />
        <CardContent>
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Schedule sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="body2" color="text.secondary">
              No upcoming sessions scheduled
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Show only the next 5 sessions
  const displaySessions = sessions.slice(0, 5);

  return (
    <Card>
      <CardHeader 
        title="Upcoming Sessions"
        action={
          sessions.length > 5 && onViewAll && (
            <Button 
              size="small" 
              endIcon={<ChevronRight />}
              onClick={onViewAll}
            >
              View All
            </Button>
          )
        }
      />
      <CardContent sx={{ pt: 0 }}>
        <List disablePadding>
          {displaySessions.map((session, index) => (
            <React.Fragment key={session.id}>
              <ListItem disablePadding sx={{ py: 1 }}>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <Person />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle2">
                        {session.clientName}
                      </Typography>
                      <Chip
                        label={session.status}
                        size="small"
                        color={getStatusColor(session.status) as any}
                        variant="outlined"
                      />
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <Schedule fontSize="small" color="action" />
                        <Typography variant="caption">
                          {formatDate(session.startTime)} at {formatTime(session.startTime)} - {formatTime(session.endTime)}
                        </Typography>
                      </Box>
                      {session.location && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <LocationOn fontSize="small" color="action" />
                          <Typography variant="caption" color="text.secondary">
                            {session.location}
                          </Typography>
                        </Box>
                      )}
                      <Typography variant="caption" color="primary.main" sx={{ fontWeight: 500 }}>
                        {session.sessionType}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
              {index < displaySessions.length - 1 && <Divider />}
            </React.Fragment>
          ))}
        </List>
      </CardContent>
    </Card>
  );
};

export default UpcomingSessionsWidget;