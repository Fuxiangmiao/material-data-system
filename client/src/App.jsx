import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AppLayout from './components/Layout/AppLayout';
import LoginModal from './components/Layout/LoginModal';
import GuestGuard from './components/GuestGuard';
import WelcomePage from './pages/WelcomePage';
import MaterialPage from './pages/MaterialPage';
import SelectionPage from './pages/SelectionPage';
import OverseasPage from './pages/OverseasPage';
import EntryPage from './pages/EntryPage';
import ImportPage from './pages/ImportPage';
import ComparePage from './pages/ComparePage';
import ExportPage from './pages/ExportPage';
import AttachmentsPage from './pages/AttachmentsPage';
import BatchAttachPage from './pages/BatchAttachPage';
import DataInitPage from './pages/DataInitPage';
import UserManagePage from './pages/UserManagePage';
import RecordDetail from './components/Detail/RecordDetail';

export default function App() {
  const { user, showLogin } = useAuth();

  if (!user || showLogin) {
    return <LoginModal />;
  }

  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/material" element={<MaterialPage />} />
        <Route path="/material/:id" element={<RecordDetail module="material" />} />
        <Route path="/selection" element={<SelectionPage />} />
        <Route path="/selection/:id" element={<RecordDetail module="selection" />} />
        <Route path="/overseas" element={<OverseasPage />} />
        <Route path="/overseas/:id" element={<RecordDetail module="overseas" />} />
        <Route path="/entry/:module" element={<GuestGuard><EntryPage /></GuestGuard>} />
        <Route path="/import/:module" element={<GuestGuard><ImportPage /></GuestGuard>} />
        <Route path="/export/:module" element={<ExportPage />} />
        <Route path="/compare/:module" element={<GuestGuard><ComparePage /></GuestGuard>} />
        <Route path="/attachments" element={<AttachmentsPage />} />
        <Route path="/batch-attach" element={<GuestGuard><BatchAttachPage /></GuestGuard>} />
        <Route path="/data-init/:module" element={<GuestGuard><DataInitPage /></GuestGuard>} />
        <Route path="/users" element={<UserManagePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
