import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import Home from './pages/Home';
import Sessions from './pages/Sessions';
import MovieDetails from './pages/MovieDetails';
import Profile from './pages/Profile';
import AuthModal from './components/AuthModal';
import RegisterModal from './components/RegisterModal';

function AuthRequestStatus() {
  const { token, profileSyncError, profileSyncLoading, retryProfileSync, logoutError, logoutLoading, retryLogout } = useAuth();

  if (logoutError) return <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
    <p role="alert">{logoutError}</p>
    <button type="button" onClick={retryLogout} disabled={logoutLoading} className="rounded-full bg-red-500/20 px-3 py-1.5 font-semibold text-white disabled:opacity-50">{logoutLoading ? 'Retrying...' : 'Retry logout'}</button>
  </div>;
  if (logoutLoading) return <p role="status" className="mb-4 text-xs text-gray-400">Signing out...</p>;
  if (profileSyncError) return <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-200">
    <p role="alert">{profileSyncError}</p>
    <button type="button" onClick={retryProfileSync} disabled={profileSyncLoading} className="rounded-full bg-red-500/20 px-3 py-1.5 font-semibold text-white disabled:opacity-50">{profileSyncLoading ? 'Retrying...' : 'Retry profile'}</button>
  </div>;
  if (token && profileSyncLoading) return <p role="status" className="mb-4 text-xs text-gray-400">Checking your session...</p>;
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-[#0B0E17] text-white">
          <Header />
          <main className="max-w-[1920px] mx-auto px-8 py-6">
            <AuthRequestStatus />
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/sessions" element={<Sessions />} />
              <Route path="/movies/:slug" element={<MovieDetails />} />
              <Route path="/profile" element={<Profile />} />
            </Routes>
          </main>
          <AuthModal />
          <RegisterModal />
        </div>
      </Router>
    </AuthProvider>
  );
}