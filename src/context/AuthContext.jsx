import { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  getProfileApi,
  loginApi,
  logoutApi,
  registerApi,
  updateProfileApi,
} from '../api/cinema';
import { retryPendingRequests, setupAxiosInterceptors } from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [profileSyncError, setProfileSyncError] = useState('');
  const [profileSyncLoading, setProfileSyncLoading] = useState(Boolean(localStorage.getItem('token')));
  const [profileSyncRetry, setProfileSyncRetry] = useState(0);
  const [logoutError, setLogoutError] = useState('');
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [logoutRetryToken, setLogoutRetryToken] = useState('');
  const logoutLock = useRef(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setupAxiosInterceptors((_error) => {
      setUser(null);
      setToken(null);
      setIsAuthOpen(true);
    });
    if (!token) {
      return () => { cancelled = true; };
    }
    getProfileApi()
        .then((response) => {
          if (cancelled || localStorage.getItem('token') !== token) return;
          const profile = response.data?.data?.user || response.data?.data || response.data?.user || response.data;
          setProfileSyncError('');
          setUser(profile);
          localStorage.setItem('user', JSON.stringify(profile));
        })
        .catch((error) => {
          if (cancelled || error.response?.status === 401) return;
          setProfileSyncError(error.response?.data?.message || 'Your profile could not be refreshed. Please retry.');
        })
        .finally(() => {
          if (!cancelled) setProfileSyncLoading(false);
        });
    return () => { cancelled = true; };
  }, [token, profileSyncRetry]);

  const retryProfileSync = () => {
    setProfileSyncLoading(true);
    setProfileSyncError('');
    setProfileSyncRetry((attempt) => attempt + 1);
  };

  const openAuthModal = (action = null) => {
    if (typeof action === 'function') {
      setPendingAction(() => action);
    }
    setIsRegisterOpen(false);
    setIsAuthOpen(true);
  };

  const openRegisterModal = () => {
    setIsAuthOpen(false);
    setIsRegisterOpen(true);
  };

  const closeModals = () => {
    setIsAuthOpen(false);
    setIsRegisterOpen(false);
    setPendingAction(null);
  };

  const executeProtected = (actionFn) => {
    if (user && token) {
      actionFn(user);
    } else {
      openAuthModal(actionFn);
    }
  };

  const handleLoginSuccess = (userData, tokenData, replayPendingAction = true) => {
    setUser(userData);
    setToken(tokenData);
    setProfileSyncLoading(true);
    setProfileSyncError('');
    setLogoutError('');
    setLogoutRetryToken('');
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('token', tokenData);
    setIsAuthOpen(false);
    setIsRegisterOpen(false);
    retryPendingRequests();

    if (replayPendingAction && pendingAction) {
      pendingAction(userData);
    }
    setPendingAction(null);
  };

  const login = async (email, password) => {
    const res = await loginApi({ email, password });
    const payload = res.data?.data || res.data;
    const { user: loggedUser, token: authToken } = payload;
    handleLoginSuccess(loggedUser, authToken);
  };

  const register = async (formData) => {
    const res = await registerApi(formData);
    const payload = res.data?.data || res.data;
    const { user: registeredUser, token: authToken } = payload;
    handleLoginSuccess({
      ...registeredUser,
      username: formData.get('username'),
      email: formData.get('email'),
    }, authToken, false);
  };

  const updateProfile = async (profile) => {
    const response = await updateProfileApi(profile);
    const payload = response.data?.data?.user || response.data?.data || response.data?.user || response.data;
    setUser(payload);
    localStorage.setItem('user', JSON.stringify(payload));
    return payload;
  };

  const requestLogout = async (sessionToken) => {
    try {
      await logoutApi(sessionToken);
      setLogoutError('');
      setLogoutRetryToken('');
    } catch (error) {
      if (error.response?.status !== 401) {
        setLogoutError('You are signed out here, but the server session could not be closed. Please retry.');
        setLogoutRetryToken(sessionToken);
      }
    }
  };

  const logout = async () => {
    if (logoutLock.current) return;
    logoutLock.current = true;
    const sessionToken = token || localStorage.getItem('token');
    setLogoutLoading(true);
    setLogoutError('');
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setIsAuthOpen(false);
    setIsRegisterOpen(false);
    setPendingAction(null);
    try {
      if (sessionToken) await requestLogout(sessionToken);
    } finally {
      logoutLock.current = false;
      setLogoutLoading(false);
    }
  };

  const retryLogout = async () => {
    if (logoutLock.current || !logoutRetryToken) return;
    logoutLock.current = true;
    setLogoutLoading(true);
    try {
      await requestLogout(logoutRetryToken);
    } finally {
      logoutLock.current = false;
      setLogoutLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      profileSyncError,
      profileSyncLoading,
      logoutError,
      logoutLoading,
      isAuthOpen,
      isRegisterOpen,
      openAuthModal,
      openRegisterModal,
      closeModals,
      executeProtected,
      login,
      register,
      updateProfile,
      retryProfileSync,
      retryLogout,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);