import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import DefinitionsPage from "./pages/DefinitionsPage";
import SearchPage from "./pages/SearchPage";
import DetailPage from "./pages/DetailPage";
import HumanTasksPage from "./pages/HumanTasksPage";
import HumanTaskSearchPage from "./pages/HumanTaskSearchPage";
import WorkflowListPage from "./pages/WorkflowListPage";
import ReviewFailuresPage from "./pages/ReviewFailuresPage";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/definitions" replace />} />
          <Route path="/definitions" element={<DefinitionsPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/workflows/recent" element={<WorkflowListPage preset="recent" title="Recent Workflows" />} />
          <Route path="/workflows/active" element={<WorkflowListPage preset="active"  title="Active Workflows" />} />
          <Route path="/detail/:workflowId/:runId" element={<DetailPage />} />
          <Route path="/tasks"           element={<HumanTasksPage key="all"       defaultTab="All" />} />
          <Route path="/tasks/pending"   element={<HumanTasksPage key="pending"   defaultTab="Pending" />} />
          <Route path="/tasks/completed" element={<HumanTasksPage key="completed" defaultTab="Completed" />} />
          <Route path="/tasks/search"    element={<HumanTaskSearchPage />} />
          <Route path="/review-failures"        element={<ReviewFailuresPage />} />
          <Route path="/review-failures/:taskId" element={<ReviewFailuresPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
