import { createBrowserRouter } from "react-router-dom";
import MarketingLayout from "@/components/layout/MarketingLayout";
import AppLayout from "@/components/layout/AppLayout";
import LandingPage from "@/page/LandingPage";
import LoginPage from "@/page/LoginPage";
import RegisterPage from "@/page/RegisterPage";
import DashboardPage from "@/page/DashboardPage";
import CreatePage from "@/page/CreatePage";
import ProjectListPage from "@/page/ProjectListPage";
import ProjectDetailPage from "@/page/ProjectDetailPage";
import DownloadPage from "@/page/DownloadPage";
import BillingPage from "@/page/BillingPage";
import ProfilePage from "@/page/ProfilePage";
import AdminPage from "@/page/AdminPage";
import NotFoundPage from "@/page/NotFoundPage";

export const router = createBrowserRouter([
  {
    element: <MarketingLayout />,
    children: [{ path: "/", element: <LandingPage /> }],
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
    element: <AppLayout />,
    children: [
      { path: "/dashboard", element: <DashboardPage /> },
      { path: "/create", element: <CreatePage /> },
      { path: "/projects", element: <ProjectListPage /> },
      { path: "/projects/:id", element: <ProjectDetailPage /> },
      { path: "/projects/:id/download", element: <DownloadPage /> },
      { path: "/billing", element: <BillingPage /> },
      { path: "/profile", element: <ProfilePage /> },
      { path: "/admin", element: <AdminPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);
