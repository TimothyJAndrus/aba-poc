import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Chip,
  Avatar,
  IconButton,
  Button,
  Menu,
  MenuItem,
  Tooltip,
  Alert,
  Collapse,
} from '@mui/material';
import {
  MoreVert,
  Person,
  Schedule,
  LocationOn,
  Edit,
  Cancel,
  Reschedule,
  CheckCircle,
  Warning,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { CalendarEvent, ClientSession, EmployeeSession } from '../../types';
import { format, isToday, isTomorrow, isYesterday } from 'date-fns';
import { useTheme } from '@mui/material/styles';

interface SessionCardProps {
  session: CalendarEvent | ClientSession | EmployeeSession;
  variant?: 'calendar' | 'list' | 'compact';
  showActions?: boolean;
  onEdit?: (sessionId: string) => void;
  onCancel?: (sessionId: string) => void;
  onReschedule?: (sessionId: string) => void;
  onComplete?: (sessionId: string) => void;
  userRole?: 'admin' | 'employee' | 'client';
  conflicts?: string[];
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  variant = 'list',
  showActions = true,
  onEdit,
  onCancel,
  onReschedule,
  onComplete,
  userRole = 'client',
  conflicts = [],
}) => {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [showConflicts, setShowConflicts] = useState(false);

  const isCalendarEvent = 'type' in session;
  const isClientSession = 'childName' in session;
  const isEmployeeSession = 'clientName' in session;

  // Extract common properties
  const sessionId = session.id;
  const startTime = isCalendarEvent ? session.start : session.startTime;
  const endTime = isCalendarEvent ? session.end : session.endTime;
  const status = session.status;
  const title = isCalendarEvent ? session.title : 
    isClientSession ? `Session with ${session.rbtName}` :
    `Session with ${session.clientName}`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'success';
      case 'completed':
        return 'info';
      case 'cancelled':
        return 'error';
      case 'rescheduled':
        return 'warning';
      case 'in-progress':
        return 'primary';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Schedule fontSize="small" />;
      case 'completed':
        return <CheckCircle fontSize="small" />;
      case 'cancelled':
        return <ErrorIcon fontSize="small" />;
      case 'rescheduled':
        return <Reschedule fontSize="small" />;
      case 'in-progress':
        return <Schedule fontSize="small" />;
      default:
        return <Schedule fontSize="small" />;
    }
  };

  const formatTimeDisplay = (start: Date, end: Date) => {
    if (isToday(start)) {
      return `Today, ${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
    } else if (isTomorrow(start)) {
      return `Tomorrow, ${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
    } else if (isYesterday(start)) {
      return `Yesterday, ${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`;
    } else {
      return `${format(start, 'MMM d, h:mm a')} - ${format(end, 'h:mm a')}`;
    }
  };

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const canEdit = userRole === 'admin' || (userRole === 'employee' && isCalendarEvent && session.type === 'time-off');
  const canCancel = userRole === 'admin' || userRole === 'client';
  const canReschedule = userRole === 'admin' || userRole === 'client';
  const canComplete = userRole === 'admin' || userRole === 'employee';

  if (variant === 'compact') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          borderRadius: 1,
          backgroundColor: theme.palette.grey[50],
          border: conflicts.length > 0 ? `2px solid ${theme.palette.warning.main}` : 'none',
        }}
      >
        <Chip
          icon={getStatusIcon(status)}
          label={status}
          color={getStatusColor(status) as any}
          size="small"
        />
        <Typography variant="body2" sx={{ flex: 1 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {format(startTime, 'h:mm a')}
        </Typography>
      </Box>
    );
  }

  return (
    <Card
      elevation={variant === 'calendar' ? 0 : 1}
      sx={{
        border: conflicts.length > 0 ? `2px solid ${theme.palette.warning.main}` : undefined,
        borderRadius: 2,
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          elevation: 3,
          transform: 'translateY(-1px)',
        },
      }}
    >
      <CardContent sx={{ pb: showActions ? 1 : 2 }}>
        {/* Header with status and actions */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              icon={getStatusIcon(status)}
              label={status}
              color={getStatusColor(status) as any}
              size="small"
              variant="outlined"
            />
            {conflicts.length > 0 && (
              <Tooltip title="Scheduling conflicts detected">
                <IconButton
                  size="small"
                  color="warning"
                  onClick={() => setShowConflicts(!showConflicts)}
                >
                  <Warning />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          
          {showActions && (
            <IconButton size="small" onClick={handleMenuClick}>
              <MoreVert />
            </IconButton>
          )}
        </Box>

        {/* Session Title */}
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>

        {/* Time Information */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Schedule color="action" fontSize="small" />
          <Typography variant="body2" color="text.secondary">
            {formatTimeDisplay(startTime, endTime)}
          </Typography>
        </Box>

        {/* Participants */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Person color="action" fontSize="small" />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isClientSession && (
              <>
                <Avatar sx={{ width: 24, height: 24 }}>
                  {session.childName.charAt(0)}
                </Avatar>
                <Typography variant="body2" color="text.secondary">
                  {session.childName}
                </Typography>
              </>
            )}
            {isEmployeeSession && (
              <>
                <Avatar sx={{ width: 24, height: 24 }}>
                  {session.clientName.charAt(0)}
                </Avatar>
                <Typography variant="body2" color="text.secondary">
                  {session.clientName}
                </Typography>
              </>
            )}
            {isCalendarEvent && session.participants.client && (
              <>
                <Avatar sx={{ width: 24, height: 24 }}>
                  {session.participants.client.name.charAt(0)}
                </Avatar>
                <Typography variant="body2" color="text.secondary">
                  {session.participants.client.name}
                </Typography>
              </>
            )}
          </Box>
        </Box>

        {/* Location (if available) */}
        {((isClientSession || isEmployeeSession) && 'location' in session && session.location) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LocationOn color="action" fontSize="small" />
            <Typography variant="body2" color="text.secondary">
              {session.location}
            </Typography>
          </Box>
        )}

        {/* Session Type */}
        {(isClientSession || isEmployeeSession) && 'sessionType' in session && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Session Type: {session.sessionType}
          </Typography>
        )}

        {/* Conflicts Alert */}
        <Collapse in={showConflicts}>
          <Alert severity="warning" sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight="medium" gutterBottom>
              Scheduling Conflicts:
            </Typography>
            {conflicts.map((conflict, index) => (
              <Typography key={index} variant="body2">
                • {conflict}
              </Typography>
            ))}
          </Alert>
        </Collapse>
      </CardContent>

      {/* Actions */}
      {showActions && (
        <CardActions sx={{ pt: 0, px: 2, pb: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {status === 'scheduled' && canComplete && onComplete && (
              <Button
                size="small"
                variant="outlined"
                color="success"
                startIcon={<CheckCircle />}
                onClick={() => onComplete(sessionId)}
              >
                Complete
              </Button>
            )}
            
            {status === 'scheduled' && canReschedule && onReschedule && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Reschedule />}
                onClick={() => onReschedule(sessionId)}
              >
                Reschedule
              </Button>
            )}
          </Box>
        </CardActions>
      )}

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {canEdit && onEdit && (
          <MenuItem onClick={() => { onEdit(sessionId); handleMenuClose(); }}>
            <Edit fontSize="small" sx={{ mr: 1 }} />
            Edit Session
          </MenuItem>
        )}
        
        {status === 'scheduled' && canReschedule && onReschedule && (
          <MenuItem onClick={() => { onReschedule(sessionId); handleMenuClose(); }}>
            <Reschedule fontSize="small" sx={{ mr: 1 }} />
            Reschedule
          </MenuItem>
        )}
        
        {status === 'scheduled' && canCancel && onCancel && (
          <MenuItem onClick={() => { onCancel(sessionId); handleMenuClose(); }}>
            <Cancel fontSize="small" sx={{ mr: 1 }} />
            Cancel Session
          </MenuItem>
        )}
        
        {status === 'scheduled' && canComplete && onComplete && (
          <MenuItem onClick={() => { onComplete(sessionId); handleMenuClose(); }}>
            <CheckCircle fontSize="small" sx={{ mr: 1 }} />
            Mark Complete
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

export default SessionCard;