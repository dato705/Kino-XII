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
    <header className="sticky top-0 z-50 border-b border-gray-800/60 bg-[#0B0E17] px-4 py-3 text-white sm:px-6 sm:py-4 lg:px-8">
      <div className="mx-auto flex max-w-[1920px] items-center justify-between gap-3 sm:gap-6">
        {/* Logo & Navigation */}
        <div className="flex items-center gap-4 sm:gap-10">
          <Link to="/" className="flex items-center gap-1 text-lg font-black tracking-wider sm:text-xl">
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
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Search Bar */}
          <div className="relative hidden w-64 md:block md:w-80">
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
                <div className="absolute right-0 top-full z-50 mt-3 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-800/80 bg-[#070b1e] p-4 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-indigo-500 text-sm font-bold text-white">
                      {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{displayName}</p>
                      <p className="truncate text-xs text-gray-400">{email}</p>
                    </div>
                  </div>
                  <div className={`mt-3 rounded-lg px-3 py-2 ${user?.profileComplete ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {user?.profileComplete ? 'Profile Complete' : 'Profile incomplete'}
                      {user?.profileComplete ? (
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                          <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.26a1 1 0 0 1-1.42 0l-3.8-3.83a1 1 0 0 1 1.42-1.41l3.09 3.11 6.49-6.54a1 1 0 0 1 1.414-.004Z" clipRule="evenodd" />
                        </svg>
                      ) : null}
                    </p>
                    {!user?.profileComplete && <p className="mt-0.5 text-xs text-gray-400">Please complete your profile to enable booking</p>}
                  </div>
                  <Link
                    to="/profile"
                    onClick={() => setIsProfileOpen(false)}
                    className="mt-2 flex items-center gap-2 rounded-lg px-1 py-2 text-sm font-semibold text-white transition hover:text-gray-300"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M20 21a8 8 0 0 0-16 0m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                    </svg>
                    My Profile
                  </Link>
                  <Link
                    to="/sessions"
                    onClick={() => setIsProfileOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-1 py-2 text-sm font-semibold text-white transition hover:text-gray-300"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v1.25a2.75 2.75 0 0 0 0 5.5v2.25A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-2.25a2.75 2.75 0 0 0 0-5.5V7.5Zm8 1a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 0 1.5 0v-1.5a.75.75 0 0 0-.75-.75Zm0 5a.75.75 0 0 0-.75.75v1.5a.75.75 0 0 0 1.5 0v-1.5a.75.75 0 0 0-.75-.75Z" />
                    </svg>
                    My Tickets
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      setIsProfileOpen(false);
                    }}
                    className="mt-1 flex w-full items-center gap-2 border-t border-gray-800 pt-3 text-left text-sm font-semibold text-red-500 transition hover:text-red-400"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M10 17l5-5-5-5m5 5H3m9-9h5a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4h-5" />
                    </svg>
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
                className="rounded-full bg-red-500 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-red-600 sm:px-5"
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="rounded-full border border-white/20 px-3 py-2.5 text-xs font-bold text-white transition hover:bg-white/10 sm:px-5"
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