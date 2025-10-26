import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  styled,
  useTheme,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  TrendingFlat,
} from '@mui/icons-material';

export interface TrendData {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
  period?: string;
}

export interface MetricCardProps {
  title: string;
  value: string | number;
  trend?: TrendData;
  sparklineData?: number[];
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  subtitle?: string;
  onClick?: () => void;
  loading?: boolean;
}

const StyledCard = styled(Card)<{ clickable?: boolean }>(({ theme, clickable }) => ({
  cursor: clickable ? 'pointer' : 'default',
  transition: 'all 0.2s ease-in-out',
  '&:hover': clickable ? {
    transform: 'translateY(-2px)',
    boxShadow: theme.shadows[3],
  } : {},
}));

const MetricValue = styled(Typography)(({ theme }) => ({
  fontSize: '2rem',
  fontWeight: 700,
  lineHeight: 1.2,
  marginBottom: theme.spacing(0.5),
}));

const TrendContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  marginTop: theme.spacing(1),
}));

const SparklineContainer = styled(Box)(({ theme }) => ({
  height: 40,
  marginTop: theme.spacing(1),
  display: 'flex',
  alignItems: 'end',
  gap: 1,
}));

const SparklineBar = styled('div')<{ height: number; color: string }>(({ height, color }) => ({
  width: 3,
  height: `${height}%`,
  backgroundColor: color,
  borderRadius: 1,
  transition: 'height 0.3s ease',
}));

const getTrendIcon = (direction: TrendData['direction']) => {
  switch (direction) {
    case 'up':
      return <TrendingUp fontSize="small" />;
    case 'down':
      return <TrendingDown fontSize="small" />;
    case 'stable':
    default:
      return <TrendingFlat fontSize="small" />;
  }
};

const getTrendColor = (direction: TrendData['direction']) => {
  switch (direction) {
    case 'up':
      return 'success';
    case 'down':
      return 'error';
    case 'stable':
    default:
      return 'default';
  }
};

const getColorValue = (color: MetricCardProps['color'], theme: any) => {
  switch (color) {
    case 'success':
      return theme.palette.success.main;
    case 'warning':
      return theme.palette.warning.main;
    case 'error':
      return theme.palette.error.main;
    case 'info':
      return theme.palette.info.main;
    case 'primary':
    default:
      return theme.palette.primary.main;
  }
};

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  trend,
  sparklineData,
  color = 'primary',
  subtitle,
  onClick,
  loading = false,
}) => {
  const theme = useTheme();
  
  const normalizeSparklineData = (data: number[]) => {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min;
    
    if (range === 0) return data.map(() => 50);
    
    return data.map(val => ((val - min) / range) * 80 + 10);
  };

  return (
    <StyledCard clickable={!!onClick} onClick={onClick}>
      <CardContent>
        <Typography
          variant="body2"
          color="text.secondary"
          gutterBottom
          sx={{ fontWeight: 500 }}
        >
          {title}
        </Typography>
        
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', height: 60 }}>
            <Typography variant="body2" color="text.secondary">
              Loading...
            </Typography>
          </Box>
        ) : (
          <>
            <MetricValue
              sx={{
                color: getColorValue(color, theme),
              }}
            >
              {typeof value === 'number' ? value.toLocaleString() : value}
            </MetricValue>
            
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
            
            {trend && (
              <TrendContainer>
                <Chip
                  icon={getTrendIcon(trend.direction)}
                  label={`${trend.percentage > 0 ? '+' : ''}${trend.percentage}%`}
                  size="small"
                  color={getTrendColor(trend.direction) as any}
                  variant="outlined"
                />
                {trend.period && (
                  <Typography variant="caption" color="text.secondary">
                    vs {trend.period}
                  </Typography>
                )}
              </TrendContainer>
            )}
            
            {sparklineData && sparklineData.length > 0 && (
              <SparklineContainer>
                {normalizeSparklineData(sparklineData).map((height, index) => (
                  <SparklineBar
                    key={index}
                    height={height}
                    color={getColorValue(color, theme)}
                  />
                ))}
              </SparklineContainer>
            )}
          </>
        )}
      </CardContent>
    </StyledCard>
  );
};

export default MetricCard;