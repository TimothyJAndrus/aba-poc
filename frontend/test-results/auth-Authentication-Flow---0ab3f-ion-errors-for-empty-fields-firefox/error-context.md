# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: "[plugin:vite:import-analysis] Failed to resolve import \"@tanstack/react-query-devtools\" from \"src/providers/QueryProvider.tsx\". Does the file exist?"
  - generic [ref=e5]: /Users/timothyjamesandrus/dev/aba-poc/frontend/src/providers/QueryProvider.tsx:3:35
  - generic [ref=e6]: "1 | import React from \"react\"; 2 | import { QueryClient, QueryClientProvider } from \"@tanstack/react-query\"; 3 | import { ReactQueryDevtools } from \"@tanstack/react-query-devtools\"; | ^ 4 | import { ApiError, NetworkError, AuthenticationError } from \"../services/api\"; 5 | var _jsxFileName = \"/Users/timothyjamesandrus/dev/aba-poc/frontend/src/providers/QueryProvider.tsx\";"
  - generic [ref=e7]: at TransformPluginContext._formatLog (file:///Users/timothyjamesandrus/dev/aba-poc/frontend/node_modules/vite/dist/node/chunks/dep-ySrR9pW8.js:30456:43) at TransformPluginContext.error (file:///Users/timothyjamesandrus/dev/aba-poc/frontend/node_modules/vite/dist/node/chunks/dep-ySrR9pW8.js:30453:14) at normalizeUrl (file:///Users/timothyjamesandrus/dev/aba-poc/frontend/node_modules/vite/dist/node/chunks/dep-ySrR9pW8.js:28865:18) at async file:///Users/timothyjamesandrus/dev/aba-poc/frontend/node_modules/vite/dist/node/chunks/dep-ySrR9pW8.js:28923:32 at async Promise.all (index 2) at async TransformPluginContext.transform (file:///Users/timothyjamesandrus/dev/aba-poc/frontend/node_modules/vite/dist/node/chunks/dep-ySrR9pW8.js:28891:4) at async EnvironmentPluginContainer.transform (file:///Users/timothyjamesandrus/dev/aba-poc/frontend/node_modules/vite/dist/node/chunks/dep-ySrR9pW8.js:30246:14) at async loadAndTransform (file:///Users/timothyjamesandrus/dev/aba-poc/frontend/node_modules/vite/dist/node/chunks/dep-ySrR9pW8.js:25261:26)
  - generic [ref=e8]:
    - text: Click outside, press Esc key, or fix the code to dismiss.
    - text: You can also disable this overlay by setting
    - code [ref=e9]: server.hmr.overlay
    - text: to
    - code [ref=e10]: "false"
    - text: in
    - code [ref=e11]: vite.config.ts
    - text: .
```