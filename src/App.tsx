import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import DashboardPage from './pages/DashboardPage'
import JobsPage from './pages/JobsPage'
import JobNewPage from './pages/JobNewPage'
import JobDetailPage from './pages/JobDetailPage'
import ClientsPage from './pages/ClientsPage'
import ClientDetailPage from './pages/ClientDetailPage'
import CarsPage from './pages/CarsPage'
import CarDetailPage from './pages/CarDetailPage'
import StockPage from './pages/StockPage'
import NotificationsPage from './pages/NotificationsPage'
import TimeOffPage from './pages/TimeOffPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import TrackingPage from './pages/TrackingPage'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/tracking/:token" element={<TrackingPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="programari" element={<JobsPage />} />
          <Route path="programari/nou" element={<JobNewPage />} />
          <Route path="programari/:id" element={<JobDetailPage />} />
          <Route path="clienti" element={<ClientsPage />} />
          <Route path="clienti/:id" element={<ClientDetailPage />} />
          <Route path="masini" element={<CarsPage />} />
          <Route path="masini/:id" element={<CarDetailPage />} />
          <Route path="stoc" element={<StockPage />} />
          <Route path="notificari" element={<NotificationsPage />} />
          <Route path="concedii" element={<TimeOffPage />} />
          <Route path="rapoarte" element={<ReportsPage />} />
          <Route path="setari" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
