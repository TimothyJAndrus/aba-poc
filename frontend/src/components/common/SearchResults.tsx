import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Chip,
  Divider,
  Paper,
  IconButton,
  Tooltip,
  Skeleton,
} from '@mui/material';
import {
  Person as PersonIcon,
  Event as EventIcon,
  Group as GroupIcon,
  Business as BusinessIcon,
  Schedule as ScheduleIcon,
  Bookmark as BookmarkIcon,
  BookmarkBorder as BookmarkBorderIcon,
} from '@mui/icons-material';
import { SearchResult, SearchResponse } from '../../services/searchService';

interface SearchResultsProps {
  results: SearchResponse | null;
  loading?: boolean;
  onResultClick?: (result: SearchResult) => void;
  onSaveResult?: (result: SearchResult) => void;
  savedResultIds?: Set<string>;
  showCategories?: boolean;
  maxResults?: number;
}

const getResultIcon = (type: string) => {
  switch (type) {
    case 'user':
      return <PersonIcon />;
    case 'session':
      return <EventIcon />;
    case 'client':
      return <PersonIcon color="primary" />;
    case 'rbt':
      return <PersonIcon color="secondary" />;
    case 'team':
      return <GroupIcon />;
    default:
      return <BusinessIcon />;
  }
};

const getResultColor = (type: string) => {
  switch (type) {
    case 'user':
      return '#2563eb';
    case 'session':
      return '#059669';
    case 'client':
      return '#d97706';
    case 'rbt':
      return '#0891b2';
    case 'team':
      return '#dc2626';
    default:
      return '#64748b';
  }
};

const SearchResultItem: React.FC<{
  result: SearchResult;
  onResultClick?: (result: SearchResult) => void;
  onSaveResult?: (result: SearchResult) => void;
  isSaved?: boolean;
}> = ({ result, onResultClick, onSaveResult, isSaved }) => {
  const handleClick = () => {
    if (onResultClick) {
      onResultClick(result);
    } else if (result.url) {
      window.location.href = result.url;
    }
  };

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onSaveResult) {
      onSaveResult(result);
    }
  };

  return (
    <ListItem
      button
      onClick={handleClick}
      sx={{
        borderRadius: 1,
        mb: 0.5,
        '&:hover': {
          backgroundColor: 'action.hover',
        },
      }}
    >
      <ListItemAvatar>
        <Avatar
          sx={{
            bgcolor: getResultColor(result.type),
            width: 32,
            height: 32,
          }}
        >
          {getResultIcon(result.type)}
        </Avatar>
      </ListItemAvatar>
      <ListItemText
        primary={
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body2" fontWeight="medium">
              {result.title}
            </Typography>
            <Chip
              label={result.type}
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 20 }}
            />
            {result.relevanceScore && (
              <Typography variant="caption" color="text.secondary">
                {Math.round(result.relevanceScore * 100)}% match
              </Typography>
            )}
          </Box>
        }
        secondary={
          <Box>
            {result.subtitle && (
              <Typography variant="caption" color="text.secondary" display="block">
                {result.subtitle}
              </Typography>
            )}
            {result.description && (
              <Typography variant="body2" color="text.secondary" noWrap>
                {result.description}
              </Typography>
            )}
          </Box>
        }
      />
      {onSaveResult && (
        <Tooltip title={isSaved ? 'Remove from saved' : 'Save result'}>
          <IconButton size="small" onClick={handleSave}>
            {isSaved ? <BookmarkIcon /> : <BookmarkBorderIcon />}
          </IconButton>
        </Tooltip>
      )}
    </ListItem>
  );
};

const SearchResultsLoading: React.FC = () => (
  <Box>
    {[...Array(5)].map((_, index) => (
      <Box key={index} display="flex" alignItems="center" gap={2} mb={2}>
        <Skeleton variant="circular" width={32} height={32} />
        <Box flex={1}>
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="text" width="40%" />
        </Box>
      </Box>
    ))}
  </Box>
);

export const SearchResults: React.FC<SearchResultsProps> = ({
  results,
  loading = false,
  onResultClick,
  onSaveResult,
  savedResultIds = new Set(),
  showCategories = true,
  maxResults,
}) => {
  if (loading) {
    return (
      <Paper elevation={2} sx={{ p: 2, mt: 1 }}>
        <SearchResultsLoading />
      </Paper>
    );
  }

  if (!results || results.results.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 3, mt: 1, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No results found. Try adjusting your search terms or filters.
        </Typography>
      </Paper>
    );
  }

  const displayResults = maxResults 
    ? results.results.slice(0, maxResults)
    : results.results;

  if (!showCategories) {
    return (
      <Paper elevation={2} sx={{ mt: 1 }}>
        <Box p={2}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            {results.total} results found in {results.searchTime}ms
          </Typography>
        </Box>
        <List dense>
          {displayResults.map((result) => (
            <SearchResultItem
              key={result.id}
              result={result}
              onResultClick={onResultClick}
              onSaveResult={onSaveResult}
              isSaved={savedResultIds.has(result.id)}
            />
          ))}
        </List>
      </Paper>
    );
  }

  const categories = Object.entries(results.categories);

  return (
    <Paper elevation={2} sx={{ mt: 1 }}>
      <Box p={2}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          {results.total} results found in {results.searchTime}ms
        </Typography>
      </Box>

      {categories.length > 0 ? (
        categories.map(([categoryName, categoryResults], index) => (
          <Box key={categoryName}>
            <Box px={2} py={1} bgcolor="grey.50">
              <Typography variant="subtitle2" fontWeight="medium" textTransform="capitalize">
                {categoryName} ({categoryResults.length})
              </Typography>
            </Box>
            <List dense>
              {categoryResults
                .slice(0, maxResults ? Math.ceil(maxResults / categories.length) : undefined)
                .map((result) => (
                  <SearchResultItem
                    key={result.id}
                    result={result}
                    onResultClick={onResultClick}
                    onSaveResult={onSaveResult}
                    isSaved={savedResultIds.has(result.id)}
                  />
                ))}
            </List>
            {index < categories.length - 1 && <Divider />}
          </Box>
        ))
      ) : (
        <List dense>
          {displayResults.map((result) => (
            <SearchResultItem
              key={result.id}
              result={result}
              onResultClick={onResultClick}
              onSaveResult={onSaveResult}
              isSaved={savedResultIds.has(result.id)}
            />
          ))}
        </List>
      )}

      {maxResults && results.total > maxResults && (
        <Box p={2} textAlign="center" bgcolor="grey.50">
          <Typography variant="body2" color="text.secondary">
            Showing {maxResults} of {results.total} results
          </Typography>
        </Box>
      )}
    </Paper>
  );
};