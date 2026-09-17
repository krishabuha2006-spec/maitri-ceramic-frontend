import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';
import { ROLES, DEFAULT_ROLE_PERMISSIONS, normalizePermissions } from '../utils/permissions';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const token = localStorage.getItem('maitri_auth_token');
    // Clear any stale/fake tokens immediately on startup
    const FAKE_TOKENS = ['maitri_active_session_token_2026', 'fallback-jwt-token'];
    if (token && (FAKE_TOKENS.includes(token) || token.split('.').length !== 3)) {
      localStorage.removeItem('maitri_auth_token');
      localStorage.removeItem('maitri_refresh_token');
      localStorage.removeItem('maitri_user');
      return null;
    }
    const saved = localStorage.getItem('maitri_user');
    if (token && saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) {
          let customPerms = null;
          try {
            const c = localStorage.getItem(`maitri_user_perms_${parsed.id}`);
            if (c) customPerms = JSON.parse(c);
          } catch (e) {}
          parsed.permissions = normalizePermissions(customPerms || parsed.permissions, parsed.role);
        }
        return parsed;
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  // Fetch current logged-in user profile & assigned permissions via GET /auth/me on mount
  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem('maitri_auth_token');
      if (token) {
        try {
          const res = await authService.getMe();
          if (res?.success !== false) {
            const meData = res?.data || res;
            const u = meData?.user || meData;
            const roleObj = u?.role;
            const roleName = (typeof roleObj === 'object' ? (roleObj?.roleName || roleObj?.name) : roleObj) || ROLES.SUPER_ADMIN;
            const userId = u?._id || u?.id;

            let customPerms = null;
            try {
              const byId = localStorage.getItem(`maitri_user_perms_${userId}`);
              const byEmail = u?.email ? localStorage.getItem(`maitri_user_perms_${u.email}`) : null;
              const byMobile = (u?.mobile && u?.mobile !== '-') ? localStorage.getItem(`maitri_user_perms_${u.mobile}`) : null;
              const saved = byId || byEmail || byMobile;
              if (saved) customPerms = JSON.parse(saved);
            } catch (e) {}

            const rawPerms = customPerms || meData?.permissions || u?.permissions;
            const effectivePerms = normalizePermissions(rawPerms, roleName, !rawPerms);

            const userObj = {
              id: userId,
              name: u?.name || u?.userName || 'Staff User',
              email: u?.email || '',
              mobile: u?.mobile || '',
              role: roleName,
              permissions: effectivePerms
            };
            setCurrentUser(userObj);
            localStorage.setItem('maitri_user', JSON.stringify(userObj));
          } else {
            // Token expired or invalid
            localStorage.removeItem('maitri_auth_token');
            localStorage.removeItem('maitri_refresh_token');
            localStorage.removeItem('maitri_user');
            setCurrentUser(null);
          }
        } catch (err) {
          localStorage.removeItem('maitri_auth_token');
          localStorage.removeItem('maitri_refresh_token');
          localStorage.removeItem('maitri_user');
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    };

    fetchUser();
  }, []);

  const switchRole = (newRole) => {
    const updated = {
      ...currentUser,
      role: newRole,
      permissions: normalizePermissions(DEFAULT_ROLE_PERMISSIONS[newRole], newRole, true)
    };
    setCurrentUser(updated);
    localStorage.setItem('maitri_user', JSON.stringify(updated));
  };

  const updateCurrentUserPermissions = (userId, newPerms) => {
    try {
      localStorage.setItem(`maitri_user_perms_${userId}`, JSON.stringify(newPerms));
      if (currentUser?.email) localStorage.setItem(`maitri_user_perms_${currentUser.email}`, JSON.stringify(newPerms));
      if (currentUser?.mobile) localStorage.setItem(`maitri_user_perms_${currentUser.mobile}`, JSON.stringify(newPerms));
    } catch (e) {}

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
      try {
        localStorage.setItem('maitri_user', JSON.stringify(updated));
      } catch (e) {}
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
      const refreshToken = resData?.refreshToken || res?.refreshToken;
      const userRaw = resData?.user || resData;

      if (!accessToken) {
        const errorMsg = res?.message || 'Login failed. Please check your credentials.';
        return { success: false, message: errorMsg };
      }

      localStorage.setItem('maitri_auth_token', accessToken);
      if (refreshToken) {
        localStorage.setItem('maitri_refresh_token', refreshToken);
      }

      const roleObj = userRaw?.role;
      const roleName = (typeof roleObj === 'object' ? (roleObj?.roleName || roleObj?.name) : roleObj) || ROLES.SUPER_ADMIN;
      const userId = userRaw?._id || userRaw?.id;

      let customPerms = null;
      try {
        const byId = localStorage.getItem(`maitri_user_perms_${userId}`);
        const byEmail = (userRaw?.email || credentials?.identifier) ? localStorage.getItem(`maitri_user_perms_${userRaw?.email || credentials?.identifier}`) : null;
        const byMobile = (userRaw?.mobile || credentials?.identifier) ? localStorage.getItem(`maitri_user_perms_${userRaw?.mobile || credentials?.identifier}`) : null;
        const saved = byId || byEmail || byMobile;
        if (saved) customPerms = JSON.parse(saved);
      } catch (e) {}

      const rawPerms = customPerms || userRaw?.permissions || roleObj?.permissions;
      const effectivePerms = normalizePermissions(rawPerms, roleName, !rawPerms);

      const userObj = {
        id: userId,
        name: userRaw?.name || userRaw?.userName || credentials?.identifier || 'User',
        email: userRaw?.email || '',
        mobile: userRaw?.mobile || '',
        role: roleName,
        permissions: effectivePerms
      };

      setCurrentUser(userObj);
      localStorage.setItem('maitri_user', JSON.stringify(userObj));
      return { success: true, user: userObj, message: res?.message || 'Login successful.' };
    } catch (err) {
      // Clear any stale tokens on error
      localStorage.removeItem('maitri_auth_token');
      localStorage.removeItem('maitri_refresh_token');
      localStorage.removeItem('maitri_user');
      setCurrentUser(null);
      const serverMsg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Login failed. Please try again.';
      return { success: false, message: serverMsg };
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('maitri_refresh_token');
    if (refreshToken) {
      try {
        await authService.logout(refreshToken);
      } catch (err) {}
    }
    setCurrentUser(null);
    localStorage.removeItem('maitri_user');
    localStorage.removeItem('maitri_auth_token');
    localStorage.removeItem('maitri_refresh_token');
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
