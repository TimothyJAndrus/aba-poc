import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { getMonitoringService } from '../services/MonitoringService';

export interface RequestLogData {
  method: string;
  url: string;
  statusCode: number;
  responseTime: number;
  userAgent?: string;
  ip: string;
  userId?: string;
  error?: string;
}

/**
 * Middleware to log all HTTP requests and track performance metrics
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const monitoringService = getMonitoringService();

  // Capture original end function
  const originalEnd = res.end;

  // Override end function to capture response time and log request
  res.end = function(chunk?: any, encoding?: any): Response {
    const responseTime = Date.now() - startTime;
    const isError = res.statusCode >= 400;

    // Record metrics
    monitoringService.recordRequest(responseTime, isError);

    // Prepare log data
    const logData: RequestLogData = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userId: (req as any).user?.id
    };

    // Add error information if applicable
    if (isError && (res as any).errorMessage) {
      logData.error = (res as any).errorMessage;
    }

    // Log based on status code
    if (res.statusCode >= 500) {
      logger.error('HTTP Request - Server Error', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('HTTP Request - Client Error', logData);
    } else if (responseTime > 2000) {
      logger.warn('HTTP Request - Slow Response', logData);
    } else {
      logger.info('HTTP Request', logData);
    }

    // Call original end function
    return originalEnd.call(this, chunk, encoding);
  };

  next();
};

/**
 * Middleware to capture and log unhandled errors
 */
export const errorLogger = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  const responseTime = Date.now() - (req as any).startTime;
  const monitoringService = getMonitoringService();

  // Record error metrics
  monitoringService.recordRequest(responseTime, true);

  // Log error details
  logger.error('Unhandled Request Error', {
    method: req.method,
    url: req.originalUrl || req.url,
    error: error.message,
    stack: error.stack,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userId: (req as any).user?.id,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Store error message for request logger
  (res as any).errorMessage = error.message;

  next(error);
};

/**
 * Middleware to add request start time for performance tracking
 */
export const requestTimer = (req: Request, res: Response, next: NextFunction): void => {
  (req as any).startTime = Date.now();
  next();
};