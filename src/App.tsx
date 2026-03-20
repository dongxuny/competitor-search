import { Navigate, Route, Routes } from 'react-router-dom';
import { AnalyzePage } from './pages/AnalyzePage';
import { CompetitorPage } from './pages/CompetitorPage';
import { HomePage } from './pages/HomePage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/analyze" element={<AnalyzePage />} />
      <Route path="/competitor" element={<CompetitorPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
