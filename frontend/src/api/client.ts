import axios from "axios";

const api = axios.create({
  baseURL: "/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default api;

// Auth
export const login = (password: string) =>
  api.post("/auth/login", { password });

// Dashboard
export const getDashboardStats = () => api.get("/dashboard/stats");

// Binaries
export const getProjects = (server?: string) =>
  api.get("/binaries", { params: server ? { server } : {} });
export const getProjectBuilds = (project: string, server?: string) =>
  api.get(`/binaries/detail/${project}`, { params: server ? { server } : {} });
export const deleteBuild = (project: string, build: string, server?: string) =>
  api.delete(`/binaries/detail/${project}/${build}`, {
    params: server ? { server } : {},
  });

// Config
export const getConfig = () => api.get("/config");
export const updateConfig = (data: Record<string, unknown>) =>
  api.put("/config", data);
export const testConnection = () => api.post("/config/test-connection");

// Cleanup
export const triggerCleanup = (dryRun: boolean) =>
  api.post("/cleanup/trigger", { dry_run: dryRun });
export const getCleanupStatus = () => api.get("/cleanup/status");

// Logs
export const getCleanupRuns = (limit = 20, offset = 0) =>
  api.get("/logs/runs", { params: { limit, offset } });
export const getLogs = (params: {
  run_id?: number;
  page?: number;
  page_size?: number;
}) => api.get("/logs", { params });
