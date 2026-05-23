import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { router } from "./router";
import { USE_MOCKS } from "./lib/api";
import { applyTheme, getInitialTheme } from "./lib/theme";
import "./styles/globals.css";

// Apply the saved/preferred theme before first paint to avoid a flash.
applyTheme(getInitialTheme());

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

if (USE_MOCKS) {
  console.info(
    "%c[Miltos] Mock mode enabled",
    "background: #8b5cf6; color: white; padding: 2px 8px; border-radius: 4px; font-weight: bold;",
    "\nSet VITE_USE_MOCKS=false in .env to use the real backend at /api/*"
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "rgb(var(--c-surface))",
            border: "1px solid rgb(var(--c-border))",
            color: "rgb(var(--c-fg))",
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
