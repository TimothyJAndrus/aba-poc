import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Avatar,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Person,
  Cake,
  Psychology,
  EmojiEvents,
  School,
} from '@mui/icons-material';
import type { ClientChild } from '../../types';
import { format, differenceInYears } from 'date-fns';

interface ChildInfoWidgetProps {
  child: ClientChild | null;
  loading?: boolean;
}

export const ChildInfoWidget: React.FC<ChildInfoWidgetProps> = ({
  child,
  loading = false,
}) => {
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

  if (!child) {
    return (
      <Card>
        <CardContent>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Child information not available
          </Typography>
        </CardContent>
      </Card>
    );
  }

  const age = differenceInYears(new Date(), new Date(child.dateOfBirth));

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" gap={2} mb={3}>
          <Avatar
            sx={{
              width: 64,
              height: 64,
              bgcolor: 'primary.main',
              fontSize: '1.5rem',
            }}
          >
            {child.name.charAt(0).toUpperCase()}
          </Avatar>
          <Box>
            <Typography variant="h5" component="h2" fontWeight="bold">
              {child.name}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Age: {age} years old
            </Typography>
            {child.diagnosis && (
              <Chip
                label={child.diagnosis}
                size="small"
                color="info"
                variant="outlined"
                sx={{ mt: 1 }}
              />
            )}
          </Box>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <List disablePadding>
          <ListItem disablePadding>
            <ListItemIcon>
              <Cake sx={{ color: 'primary.main' }} />
            </ListItemIcon>
            <ListItemText
              primary="Date of Birth"
              secondary={format(new Date(child.dateOfBirth), 'MMMM dd, yyyy')}
            />
          </ListItem>

          {child.currentRBT && (
            <ListItem disablePadding>
              <ListItemIcon>
                <Person sx={{ color: 'primary.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Current RBT"
                secondary={child.currentRBT.name}
              />
            </ListItem>
          )}

          {child.progressNotes && (
            <ListItem disablePadding>
              <ListItemIcon>
                <Psychology sx={{ color: 'primary.main' }} />
              </ListItemIcon>
              <ListItemText
                primary="Recent Progress"
                secondary={child.progressNotes}
              />
            </ListItem>
          )}
        </List>

        {child.sessionGoals && child.sessionGoals.length > 0 && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box>
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <EmojiEvents sx={{ color: 'success.main' }} />
                <Typography variant="subtitle2" fontWeight="bold">
                  Current Goals
                </Typography>
              </Box>
              <Box display="flex" flexWrap="wrap" gap={1}>
                {child.sessionGoals.map((goal, index) => (
                  <Chip
                    key={index}
                    label={goal}
                    size="small"
                    color="success"
                    variant="outlined"
                    icon={<School />}
                  />
                ))}
              </Box>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
};