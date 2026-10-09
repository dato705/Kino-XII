import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, token, openAuthModal, openRegisterModal, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isAuthenticated = Boolean(user && token);
  const displayName = user?.fullName || user?.username || user?.name || 'User';
  const email = user?.email || '';
  const avatar = user?.avatar_url || user?.avatar || user?.profile_image;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="bg-[#0B0E17] border-b border-gray-800/60 text-white py-4 px-8 sticky top-0 z-50">
      <div className="max-w-[1920px] mx-auto flex items-center justify-between gap-6">
        {/* Logo & Navigation */}
        <div className="flex items-center gap-10">
          <Link to="/" className="text-xl font-black tracking-wider flex items-center gap-1">
            <span>KINO</span>
            <span className="text-red-500">XII</span>
          </Link>
          <NavLink 
            to="/sessions" 
            className={({ isActive }) => 
              `text-xs tracking-widest font-bold uppercase transition ${isActive ? 'text-red-500' : 'text-gray-400 hover:text-white'}`
            }
          >
            SESSIONS
          </NavLink>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-4">
          {/* Search Bar */}
          <div className="relative w-64 md:w-80">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input 
              type="text" 
              placeholder="Search films and live events" 
              className="w-full bg-[#161B26] text-xs text-white placeholder-gray-400 rounded-full py-2.5 pl-9 pr-4 border border-gray-800 focus:outline-none focus:border-red-500 transition"
            />
          </div>

          {isAuthenticated ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsProfileOpen((open) => !open)}
                aria-expanded={isProfileOpen}
                aria-label="Open account details"
                className="flex items-center gap-3 rounded-full border border-gray-800 bg-[#161B26] py-1.5 pl-1.5 pr-4 text-left transition hover:border-gray-600"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-indigo-500 text-sm font-bold text-white">
                  {avatar ? (
                    <img src={avatar} alt="" className="h-full w-full object-cover" />
                  ) : initials}
                </span>
                <span className="hidden min-w-0 sm:block">
                  <span className="block max-w-36 truncate text-sm font-semibold text-white">{displayName}</span>
                  <span className="block max-w-36 truncate text-xs text-gray-400">{email}</span>
                </span>
                <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M5.22 7.47a.75.75 0 0 1 1.06 0L10 11.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
                </svg>
              </button>

              {isProfileOpen && (
                <div className="absolute right-0 top-full z-50 mt-3 w-72 rounded-2xl border border-gray-800 bg-[#131722] p-4 shadow-2xl">
                  <div className="flex items-center gap-3 border-b border-gray-800 pb-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-indigo-500 text-sm font-bold text-white">
                      {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                      <p className="truncate text-xs text-gray-400">{email}</p>
                    </div>
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setIsProfileOpen(false)}
                    className="mt-3 block rounded-lg px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/5"
                  >
                    {user?.profileComplete ? 'My profile' : 'Complete profile'}
                    {!user?.profileComplete && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-amber-400" />}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setIsProfileOpen(false);
                    }}
                    className="mt-3 w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-500 transition hover:bg-red-500/10"
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={openRegisterModal}
                className="rounded-full bg-red-500 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-red-600"
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="rounded-full border border-white/20 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-white/10"
              >
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}