import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Stack,
} from '@mui/material';
import {
  Circle,
  Event,
  PersonOff,
  Meeting,
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

interface LegendItem {
  label: string;
  color: string;
  icon?: React.ReactNode;
  description?: string;
}

interface CalendarLegendProps {
  compact?: boolean;
}

export const CalendarLegend: React.FC<CalendarLegendProps> = ({ compact = false }) => {
  const theme = useTheme();

  const eventTypes: LegendItem[] = [
    {
      label: 'ABA Session',
      color: theme.palette.primary.main,
      icon: <Event fontSize="small" />,
      description: 'Scheduled therapy sessions',
    },
    {
      label: 'Time Off',
      color: theme.palette.warning.main,
      icon: <PersonOff fontSize="small" />,
      description: 'Employee unavailable',
    },
    {
      label: 'Meeting',
      color: theme.palette.info.main,
      icon: <Meeting fontSize="small" />,
      description: 'Team meetings and consultations',
    },
  ];

  const statusTypes: LegendItem[] = [
    {
      label: 'Scheduled',
      color: theme.palette.success.main,
      description: 'Confirmed sessions',
    },
    {
      label: 'Completed',
      color: theme.palette.success.dark,
      description: 'Finished sessions',
    },
    {
      label: 'Cancelled',
      color: theme.palette.error.main,
      description: 'Cancelled sessions',
    },
    {
      label: 'Rescheduled',
      color: theme.palette.warning.main,
      description: 'Sessions moved to new time',
    },
  ];

  if (compact) {
    return (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {eventTypes.map((item) => (
          <Chip
            key={item.label}
            icon={<Circle sx={{ color: item.color }} />}
            label={item.label}
            size="small"
            variant="outlined"
          />
        ))}
      </Box>
    );
  }

  return (
    <Paper elevation={1} sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Calendar Legend
      </Typography>
      
      <Stack spacing={2}>
        <Box>
          <Typography variant="subtitle2" gutterBottom color="text.secondary">
            Event Types
          </Typography>
          <Stack spacing={1}>
            {eventTypes.map((item) => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24,
                    height: 24,
                    borderRadius: 1,
                    backgroundColor: item.color,
                    color: theme.palette.getContrastText(item.color),
                  }}
                >
                  {item.icon || <Circle fontSize="small" />}
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    {item.label}
                  </Typography>
                  {item.description && (
                    <Typography variant="caption" color="text.secondary">
                      {item.description}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>

        <Box>
          <Typography variant="subtitle2" gutterBottom color="text.secondary">
            Status Indicators
          </Typography>
          <Stack spacing={1}>
            {statusTypes.map((item) => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Circle sx={{ color: item.color, fontSize: 16 }} />
                <Box>
                  <Typography variant="body2" fontWeight="medium">
                    {item.label}
                  </Typography>
                  {item.description && (
                    <Typography variant="caption" color="text.secondary">
                      {item.description}
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
};

export default CalendarLegend;