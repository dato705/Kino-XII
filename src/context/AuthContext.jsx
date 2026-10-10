import { createContext, useContext, useState, useEffect } from 'react';
import {
  getFilterOptions,
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
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setupAxiosInterceptors((_error) => {
      setUser(null);
      setToken(null);
      if (!_error.config?.url?.endsWith('/me')) setIsAuthOpen(true);
    });
    getFilterOptions().catch(() => {});
    if (token) {
      getProfileApi()
        .then((response) => {
          if (cancelled || localStorage.getItem('token') !== token) return;
          const profile = response.data?.data?.user || response.data?.data || response.data?.user || response.data;
          setUser(profile);
          localStorage.setItem('user', JSON.stringify(profile));
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [token]);

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

  const logout = async () => {
    const logoutRequest = logoutApi().catch(() => {});
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setIsAuthOpen(false);
    setIsRegisterOpen(false);
    setPendingAction(null);
    try {
      await logoutRequest;
    } catch {
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthOpen,
      isRegisterOpen,
      openAuthModal,
      openRegisterModal,
      closeModals,
      executeProtected,
      login,
      register,
      updateProfile,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);