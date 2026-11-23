import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Privacy from '@/pages/privacy';
import Support from '@/pages/support';
import Home from '@/pages/home';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';

const queryClient = new QueryClient();

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  }, []);
  useEffect(() => {
    window.scrollTo(0, 0);
    const frame = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(frame);
  }, [location]);
  return null;
}

export default function App() {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <TooltipProvider>
          <WouterRouter base={basePath}>
            <ScrollToTop />
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/privacy" component={Privacy} />
              <Route path="/support" component={Support} />
              <Route component={NotFound} />
            </Switch>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
