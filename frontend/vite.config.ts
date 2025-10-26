import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  const isProduction = mode === 'production';
  
  return {
    plugins: [
      react(),
      // Sentry plugin for error monitoring and source maps upload
      isProduction && env.VITE_SENTRY_DSN && sentryVitePlugin({
        org: env.VITE_SENTRY_ORG,
        project: env.VITE_SENTRY_PROJECT,
        authToken: env.VITE_SENTRY_AUTH_TOKEN,
        sourcemaps: {
          assets: './dist/**',
          ignore: ['node_modules'],
          filesToDeleteAfterUpload: './dist/**/*.map',
        },
        release: {
          name: env.VITE_SENTRY_RELEASE || `aba-scheduling-ui@${process.env.npm_package_version}`,
          cleanArtifacts: true,
        },
      }),
    ].filter(Boolean),
    
    // Define global constants
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
      __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
      __COMMIT_HASH__: JSON.stringify(process.env.VITE_COMMIT_HASH || 'dev'),
    },
    
    build: {
      // Enable code splitting and optimize chunks
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              // Core React libraries
              if (id.includes('react') || id.includes('react-dom')) {
                return 'react-vendor';
              }
              // UI Framework
              if (id.includes('@mui') || id.includes('@emotion')) {
                return 'mui-vendor';
              }
              // Routing
              if (id.includes('react-router')) {
                return 'router-vendor';
              }
              // State Management
              if (id.includes('@reduxjs') || id.includes('react-redux') || id.includes('@tanstack')) {
                return 'state-vendor';
              }
              // Charts
              if (id.includes('chart.js') || id.includes('react-chartjs')) {
                return 'chart-vendor';
              }
              // Calendar
              if (id.includes('@fullcalendar')) {
                return 'calendar-vendor';
              }
              // Date utilities
              if (id.includes('date-fns') || id.includes('@date-io')) {
                return 'date-vendor';
              }
              // WebSocket
              if (id.includes('socket.io')) {
                return 'socket-vendor';
              }
              // Error monitoring
              if (id.includes('@sentry')) {
                return 'sentry-vendor';
              }
              // Other vendors
              return 'vendor';
            }
          },
          // Optimize asset naming for caching
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name?.split('.') || [];
            const extType = info[info.length - 1];
            
            if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
              return `assets/images/[name]-[hash][extname]`;
            }
            if (/woff2?|eot|ttf|otf/i.test(extType)) {
              return `assets/fonts/[name]-[hash][extname]`;
            }
            return `assets/[name]-[hash][extname]`;
          },
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
        },
      },
      
      // Production optimizations
      sourcemap: isProduction ? 'hidden' : true, // Hidden source maps for production
      chunkSizeWarningLimit: 1000,
      minify: isProduction ? 'terser' : false,
      
      // Terser options for production
      terserOptions: isProduction ? {
        compress: {
          drop_console: true, // Remove console.log in production
          drop_debugger: true,
          pure_funcs: ['console.log', 'console.info', 'console.debug'],
        },
        mangle: {
          safari10: true,
        },
        format: {
          comments: false,
        },
      } : undefined,
      
      // Target modern browsers for better optimization
      target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
      
      // Enable CSS code splitting
      cssCodeSplit: true,
      
      // Optimize CSS
      cssMinify: isProduction,
      
      // Report compressed file sizes
      reportCompressedSize: true,
      
      // Set chunk size limit
      chunkSizeWarningLimit: 500,
    },
    
    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@mui/material',
        '@mui/icons-material',
        'react-router-dom',
        '@reduxjs/toolkit',
        'react-redux',
        '@tanstack/react-query',
        'chart.js',
        'react-chartjs-2',
        '@fullcalendar/react',
        'socket.io-client',
        'date-fns',
      ],
      // Force optimization of these packages
      force: isProduction,
    },
    
    // Server configuration for development
    server: {
      port: 5173,
      host: true,
      cors: true,
      proxy: {
        '/api': {
          target: env.VITE_API_BASE_URL || 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        },
        '/socket.io': {
          target: env.VITE_WS_URL || 'ws://localhost:3000',
          ws: true,
          changeOrigin: true,
        },
      },
    },
    
    // Preview server configuration
    preview: {
      port: 4173,
      host: true,
      cors: true,
    },
    
    // Environment variables
    envPrefix: 'VITE_',
    
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test/setup.ts'],
      css: true,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/test/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/coverage/**',
        ],
      },
    },
  };
});
