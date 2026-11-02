import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppDialogProvider } from "./components/AppDialog";

const JobLogin = lazy(() => import("./frontend/job-login"));
const RoleSelection = lazy(() => import("./frontend/Roleseletion"));
const InstituteLogin = lazy(() => import("./frontend/college-login"));
const JobRegistration = lazy(() => import("./frontend/job-registration"));
const CollegeRegistration = lazy(() => import("./frontend/college-registration"));
const JobSeekerDashboard = lazy(() => import("./frontend/jobSeekerDashboard"));
const InstitutionDashboard = lazy(() => import("./frontend/InstitutionDashboard"));
const AdminDashboard = lazy(() => import("./frontend/AdminDashboard"));
const AdminLogin = lazy(() => import("./frontend/AdminLogin"));

function App() {
  return (
    <AppDialogProvider>
      <Suspense
        fallback={
          <main
            role="status"
            className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-600"
          >
            Loading EduVacancy...
          </main>
        }
      >
        <Routes>
          <Route path="/" element={<RoleSelection />} />
          <Route path="/job-login" element={<JobLogin />} />
          <Route path="/college-login" element={<InstituteLogin />} />
          <Route path="/college-registration" element={<CollegeRegistration />} />
          <Route path="/job-registration" element={<JobRegistration />} />
          <Route path="/jobSeekerDashboard" element={<JobSeekerDashboard />} />
          <Route path="/institutionDashboard" element={<InstitutionDashboard />} />
          <Route path="/adminDashboard" element={<AdminDashboard />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppDialogProvider>
  );
}

export default App;
