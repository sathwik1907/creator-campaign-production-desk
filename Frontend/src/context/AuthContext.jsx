import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastDevToken, setLastDevToken] = useState(null);

  useEffect(() => {
    checkCurrentSession();
  }, []);

  async function checkCurrentSession() {
    try {
      setLoading(true);
      const res = await authApi.getMe();
      if (res.success && res.data) {
        setUser(res.data.user);
        setWorkspace(res.data.workspace);
      } else {
        setUser(null);
        setWorkspace(null);
      }
    } catch (err) {
      setUser(null);
      setWorkspace(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    setError(null);
    try {
      const res = await authApi.login({ email, password });
      if (res.success && res.data) {
        setUser(res.data.user);
        setWorkspace(res.data.workspace);
        return res.data;
      }
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    }
  }

  async function signup(name, email, password) {
    setError(null);
    try {
      const res = await authApi.signup({ name, email, password });
      if (res.data?.devVerificationToken) {
        setLastDevToken(res.data.devVerificationToken);
      }
      return res;
    } catch (err) {
      setError(err.message || 'Signup failed');
      throw err;
    }
  }

  async function verifyEmail(token) {
    setError(null);
    try {
      const res = await authApi.verifyEmail({ token });
      return res;
    } catch (err) {
      setError(err.message || 'Verification failed');
      throw err;
    }
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Logout error:', err);
    } finally {
      setUser(null);
      setWorkspace(null);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        workspace,
        loading,
        error,
        lastDevToken,
        login,
        signup,
        verifyEmail,
        logout,
        refreshUser: checkCurrentSession,
        setWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
