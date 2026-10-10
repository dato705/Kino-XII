import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/Header';
import Home from './pages/Home';
import Sessions from './pages/Sessions';
import MovieDetails from './pages/MovieDetails';
import Profile from './pages/Profile';
import AuthModal from './components/AuthModal';
import RegisterModal from './components/RegisterModal';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-[#0B0E17] text-white">
          <Header />
          <main className="max-w-[1920px] mx-auto px-8 py-6">
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