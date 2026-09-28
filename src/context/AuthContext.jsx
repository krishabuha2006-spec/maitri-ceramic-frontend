import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import { ROLES, DEFAULT_ROLE_PERMISSIONS, normalizePermissions, normalizeRole, isSuperAdminRole } from '../utils/permissions';

export const AuthContext = createContext(null);

const decodeToken = (token) => {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (parsed && parsed.exp && parsed.exp * 1000 < Date.now()) {
      return null; // Token expired
    }
    const roleName = normalizeRole(parsed.role);
    return {
      id: parsed.id || parsed._id || parsed.userId,
      name: parsed.name || parsed.userName || parsed.mobile || 'User',
      email: parsed.email || '',
      mobile: parsed.mobile || '',
      role: roleName,
      permissions: normalizePermissions(parsed.permissions, roleName, true)
    };
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const token = localStorage.getItem('maitri_auth_token');
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) return decoded;
    }
    return null;
  });
  const [loading, setLoading] = useState(() => {
    const token = localStorage.getItem('maitri_auth_token');
    return !!token;
  });

  // Fetch current logged-in user profile & assigned permissions via GET /auth/me on mount using stored auth token
  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      const token = localStorage.getItem('maitri_auth_token');
      const FAKE_TOKENS = ['maitri_active_session_token_2026', 'fallback-jwt-token'];
      if (token && (FAKE_TOKENS.includes(token) || token.split('.').length !== 3)) {
        localStorage.removeItem('maitri_auth_token');
        if (isMounted) {
          setCurrentUser(null);
          setLoading(false);
        }
        return;
      }

      if (token) {
        try {
          const res = await authService.getMe();
          const meData = res?.data || res;
          const u = meData?.user || (res?.user) || (res?.success !== false && meData?._id ? meData : null);

          if (isMounted) {
            if (res && res.success !== false && u && (u._id || u.id || u.email || u.userName)) {
              const roleObj = u?.role;
              const rawRole = (typeof roleObj === 'object' ? (roleObj?.roleName || roleObj?.name) : roleObj) || ROLES.SUPER_ADMIN;
              const roleName = normalizeRole(rawRole);
              const userId = u?._id || u?.id;

              const rawPerms = meData?.permissions || u?.permissions;
              const effectivePerms = normalizePermissions(rawPerms, roleName, true);

              const userObj = {
                id: userId,
                name: u?.name || u?.userName || u?.fullName || 'Super Admin',
                email: u?.email || '',
                mobile: u?.mobile || '',
                role: roleName,
                permissions: effectivePerms
              };
              setCurrentUser(userObj);
            } else if (res?.status === 401 || res?.success === false) {
              // Only clear if explicitly unauthorized
              localStorage.removeItem('maitri_auth_token');
              setCurrentUser(null);
            }
          }
        } catch (err) {
          if (err?.response?.status === 401) {
            localStorage.removeItem('maitri_auth_token');
            if (isMounted) setCurrentUser(null);
          }
        }
      } else {
        if (isMounted) setCurrentUser(null);
      }
      if (isMounted) setLoading(false);
    };

    fetchUser();

    return () => {
      isMounted = false;
    };
  }, []);

  const switchRole = (newRole) => {
    if (!currentUser) return;
    const updated = {
      ...currentUser,
      role: newRole,
      permissions: normalizePermissions(DEFAULT_ROLE_PERMISSIONS[newRole], newRole, true)
    };
    setCurrentUser(updated);
  };

  const updateCurrentUserPermissions = (userId, newPerms) => {
    if (currentUser && (
      String(currentUser.id) === String(userId) ||
      currentUser.email === userId ||
      (currentUser.mobile && currentUser.mobile === userId)
    )) {
      const updated = {
        ...currentUser,
        permissions: normalizePermissions(newPerms, currentUser.role, false)
      };
      setCurrentUser(updated);
    }
  };

  const loginWithBackend = async (credentials) => {
    try {
      const res = await authService.login(credentials);

      // Backend returned explicit failure
      if (res?.success === false) {
        const errorMsg = res?.message || res?.error || 'Invalid credentials.';
        return { success: false, message: errorMsg };
      }

      const resData = res?.data || res;
      const accessToken = resData?.accessToken || resData?.token || res?.accessToken;
      const userRaw = resData?.user || resData;

      if (!accessToken) {
        const errorMsg = res?.message || 'Login failed. Please check your credentials.';
        return { success: false, message: errorMsg };
      }

      // ONLY save the login access token in localStorage
      localStorage.setItem('maitri_auth_token', accessToken);

      const roleObj = userRaw?.role;
      const rawRole = (typeof roleObj === 'object' ? (roleObj?.roleName || roleObj?.name) : roleObj) || ROLES.SUPER_ADMIN;
      const roleName = normalizeRole(rawRole);
      const userId = userRaw?._id || userRaw?.id;

      const rawPerms = userRaw?.permissions || roleObj?.permissions;
      const effectivePerms = normalizePermissions(rawPerms, roleName, true);

      const userObj = {
        id: userId,
        name: userRaw?.name || userRaw?.userName || credentials?.identifier || 'User',
        email: userRaw?.email || '',
        mobile: userRaw?.mobile || '',
        role: roleName,
        permissions: effectivePerms
      };

      setCurrentUser(userObj);
      return { success: true, user: userObj, message: res?.message || 'Login successful.' };
    } catch (err) {
      localStorage.removeItem('maitri_auth_token');
      setCurrentUser(null);
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Login failed. Please try again.';
      return { success: false, message: serverMsg };
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {}
    setCurrentUser(null);
    localStorage.removeItem('maitri_auth_token');
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      loading,
      switchRole,
      updateCurrentUserPermissions,
      loginWithBackend,
      logout,
      fetchMe: authService.getMe
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
