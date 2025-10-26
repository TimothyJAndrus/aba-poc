import React, { useState } from 'react';
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
  Badge,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  CircularProgress,
} from '@mui/material';
import {
  Message as MessageIcon,
  Send,
  AdminPanelSettings,
  Person,
  Add,
} from '@mui/icons-material';
import type { Message } from '../../types';
import { format } from 'date-fns';

interface CommunicationCenterProps {
  messages: Message[];
  unreadCount: number;
  loading?: boolean;
  onSendMessage?: (message: { recipientId: string; subject: string; content: string }) => void;
  onMarkAsRead?: (messageId: string) => void;
  onViewAllMessages?: () => void;
}

export const CommunicationCenter: React.FC<CommunicationCenterProps> = ({
  messages,
  unreadCount,
  loading = false,
  onSendMessage,
  onMarkAsRead,
  onViewAllMessages,
}) => {
  const [composeOpen, setComposeOpen] = useState(false);
  const [newMessage, setNewMessage] = useState({
    recipientId: '',
    subject: '',
    content: '',
  });

  const handleSendMessage = () => {
    if (onSendMessage && newMessage.recipientId && newMessage.subject && newMessage.content) {
      onSendMessage(newMessage);
      setNewMessage({ recipientId: '', subject: '', content: '' });
      setComposeOpen(false);
    }
  };

  const handleMessageClick = (message: Message) => {
    if (!message.read && onMarkAsRead) {
      onMarkAsRead(message.id);
    }
  };

  const getSenderIcon = (role: Message['senderRole']) => {
    switch (role) {
      case 'admin':
        return <AdminPanelSettings />;
      case 'employee':
        return <Person />;
      default:
        return <MessageIcon />;
    }
  };

  const getSenderColor = (role: Message['senderRole']) => {
    switch (role) {
      case 'admin':
        return 'error.main';
      case 'employee':
        return 'primary.main';
      default:
        return 'grey.500';
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
    <>
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="h6" component="h2">
                Messages
              </Typography>
              {unreadCount > 0 && (
                <Badge badgeContent={unreadCount} color="error">
                  <MessageIcon />
                </Badge>
              )}
            </Box>
            <Box display="flex" gap={1}>
              <Button
                size="small"
                startIcon={<Add />}
                onClick={() => setComposeOpen(true)}
              >
                New Message
              </Button>
              {onViewAllMessages && (
                <Button size="small" onClick={onViewAllMessages}>
                  View All
                </Button>
              )}
            </Box>
          </Box>

          {messages.length === 0 ? (
            <Box textAlign="center" py={3}>
              <MessageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No messages yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Start a conversation with your RBT or admin
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {messages.slice(0, 5).map((message, index) => (
                <React.Fragment key={message.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    alignItems="flex-start"
                    sx={{
                      px: 0,
                      cursor: 'pointer',
                      bgcolor: message.read ? 'transparent' : 'action.hover',
                      borderRadius: 1,
                      '&:hover': {
                        bgcolor: 'action.hover',
                      },
                    }}
                    onClick={() => handleMessageClick(message)}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: getSenderColor(message.senderRole) }}>
                        {getSenderIcon(message.senderRole)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography
                            variant="subtitle2"
                            fontWeight={message.read ? 'normal' : 'bold'}
                          >
                            {message.subject}
                          </Typography>
                          <Box display="flex" alignItems="center" gap={1}>
                            {!message.read && (
                              <Chip label="New" size="small" color="primary" />
                            )}
                            <Typography variant="caption" color="text.secondary">
                              {format(new Date(message.timestamp), 'MMM dd')}
                            </Typography>
                          </Box>
                        </Box>
                      }
                      secondary={
                        <Box mt={1}>
                          <Typography variant="body2" color="text.secondary">
                            From: {message.senderName} ({message.senderRole})
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5 }}
                          >
                            {message.content.substring(0, 100)}
                            {message.content.length > 100 && '...'}
                          </Typography>
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

      {/* Compose Message Dialog */}
      <Dialog open={composeOpen} onClose={() => setComposeOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Message</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} mt={1}>
            <FormControl fullWidth>
              <InputLabel>Send to</InputLabel>
              <Select
                value={newMessage.recipientId}
                label="Send to"
                onChange={(e) =>
                  setNewMessage({ ...newMessage, recipientId: e.target.value })
                }
              >
                <MenuItem value="rbt">My RBT</MenuItem>
                <MenuItem value="admin">Administrator</MenuItem>
                <MenuItem value="supervisor">Clinical Supervisor</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="Subject"
              value={newMessage.subject}
              onChange={(e) =>
                setNewMessage({ ...newMessage, subject: e.target.value })
              }
            />
            <TextField
              fullWidth
              label="Message"
              multiline
              rows={4}
              value={newMessage.content}
              onChange={(e) =>
                setNewMessage({ ...newMessage, content: e.target.value })
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComposeOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSendMessage}
            variant="contained"
            startIcon={<Send />}
            disabled={!newMessage.recipientId || !newMessage.subject || !newMessage.content}
          >
            Send Message
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};