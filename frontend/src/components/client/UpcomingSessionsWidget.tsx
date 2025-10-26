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
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  CalendarToday,
  Person,
  AccessTime,
  LocationOn,
} from '@mui/icons-material';
import type { ClientSession } from '../../types';
import { format, isToday, isTomorrow } from 'date-fns';

interface UpcomingSessionsWidgetProps {
  sessions: ClientSession[];
  loading?: boolean;
  onViewAll?: () => void;
}

export const UpcomingSessionsWidget: React.FC<UpcomingSessionsWidgetProps> = ({
  sessions,
  loading = false,
  onViewAll,
}) => {
  const getDateLabel = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM dd');
  };

  const getStatusColor = (status: ClientSession['status']) => {
    switch (status) {
      case 'scheduled':
        return 'primary';
      case 'in-progress':
        return 'success';
      case 'cancelled':
        return 'error';
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
            Upcoming Sessions
          </Typography>
          {onViewAll && (
            <Button size="small" onClick={onViewAll}>
              View All
            </Button>
          )}
        </Box>

        {sessions.length === 0 ? (
          <Box textAlign="center" py={3}>
            <CalendarToday sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">
              No upcoming sessions scheduled
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {sessions.slice(0, 5).map((session, index) => (
              <React.Fragment key={session.id}>
                {index > 0 && <Divider />}
                <ListItem alignItems="flex-start" sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main' }}>
                      <Person />
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
                        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                          <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {getDateLabel(new Date(session.startTime))}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                          <AccessTime sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            {format(new Date(session.startTime), 'h:mm a')} - {format(new Date(session.endTime), 'h:mm a')}
                          </Typography>
                        </Box>
                        <Box display="flex" alignItems="center" gap={1} mb={0.5}>
                          <Person sx={{ fontSize: 16, color: 'text.secondary' }} />
                          <Typography variant="body2" color="text.secondary">
                            RBT: {session.rbtName}
                          </Typography>
                        </Box>
                        {session.location && (
                          <Box display="flex" alignItems="center" gap={1}>
                            <LocationOn sx={{ fontSize: 16, color: 'text.secondary' }} />
                            <Typography variant="body2" color="text.secondary">
                              {session.location}
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