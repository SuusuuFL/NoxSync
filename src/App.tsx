import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Dashboard } from '@/pages/Dashboard';
import { Settings } from '@/pages/Settings';
import { ProjectLayout } from '@/components/project';
import { ProjectOverview } from '@/pages/ProjectOverview';
import { ProjectSelection } from '@/pages/ProjectSelection';
import { ProjectEdition } from '@/pages/ProjectEdition';
import { ProjectMontage } from '@/pages/ProjectMontage';
import { ProjectExport } from '@/pages/ProjectExport';
import { useTheme } from '@/hooks';
import './App.css';

export default function App() {
  useTheme(); // Initialize theme
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/project/:projectId" element={<ProjectLayout />}>
          <Route index element={<ProjectOverview />} />
          <Route path="selection" element={<ProjectSelection />} />
          <Route path="edition" element={<ProjectEdition />} />
          <Route path="montage" element={<ProjectMontage />} />
          <Route path="export" element={<ProjectExport />} />
        </Route>
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </BrowserRouter>
  );
}
