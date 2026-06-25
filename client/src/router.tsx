import { createBrowserRouter, Navigate, useParams } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import LandingPage from "@/page/LandingPage";
import LoginPage from "@/page/LoginPage";
import RegisterPage from "@/page/RegisterPage";
import DashboardPage from "@/page/DashboardPage";
import ProjectListPage from "@/page/ProjectListPage";
import EditorPage from "@/page/EditorPage";
import DownloadPage from "@/page/DownloadPage";

// /projects/:id has been retired — every click on a project goes straight
// into the editor instead of stopping at an overview page.
function ProjectToEditor() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/projects/${id}/edit`} replace />;
}
import BillingPage from "@/page/BillingPage";
import ProfilePage from "@/page/ProfilePage";
import AdminPage from "@/page/AdminPage";
import LocalTtsPage from "@/page/LocalTtsPage";
import NotFoundPage from "@/page/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    // Full-screen editor — intentionally outside AppLayout (no app sidebar).
    path: "/projects/:id/edit",
    element: <EditorPage />,
  },
  {
    element: <AppLayout />,
    children: [
      { path: "/dashboard", element: <DashboardPage section="ai-video" /> },
      { path: "/motion-graphics", element: <DashboardPage section="motion-graphics" /> },
      { path: "/ai", element: <Navigate to="/dashboard" replace /> },
      { path: "/create", element: <Navigate to="/dashboard" replace /> },
      { path: "/projects", element: <ProjectListPage /> },
      { path: "/projects/:id", element: <ProjectToEditor /> },
      { path: "/projects/:id/download", element: <DownloadPage /> },
      { path: "/local-tts", element: <LocalTtsPage /> },
      { path: "/billing", element: <BillingPage /> },
      { path: "/profile", element: <ProfilePage /> },
      { path: "/admin", element: <AdminPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
