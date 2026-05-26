import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DefinitionsPage from './pages/DefinitionsPage';
import SearchPage from './pages/SearchPage';
import DetailPage from './pages/DetailPage';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/definitions" replace />} />
          <Route path="/definitions" element={<DefinitionsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/detail/:workflowId/:runId" element={<DetailPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
