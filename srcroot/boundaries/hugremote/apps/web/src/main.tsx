import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './i18n';
import './styles/app.css';
import { router } from './app/router';
import { refreshAccessToken } from './lib/api-client';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function Boot() {
  // Khôi phục phiên từ refresh cookie (access token chỉ ở bộ nhớ nên F5 phải xin lại)
  useEffect(() => {
    void refreshAccessToken();
  }, []);
  return <RouterProvider router={router} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <Boot />
    </QueryClientProvider>
  </StrictMode>,
);
