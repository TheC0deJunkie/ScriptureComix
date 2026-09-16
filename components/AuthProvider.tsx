import React, { createContext, useContext, useEffect, useState } from 'react';
import { isFirebaseConfigured } from '../services/firebase';
import { subscribeToAuth, completeRedirectSignIn, type User } from '../services/authService';

export interface AuthState {
  /** The signed-in Firebase user, or null. */
  user: User | null;
  /** True until Firebase has reported the initial auth state. */
  loading: boolean;
  /** False when no VITE_FIREBASE_* config is present; sign-in UI should hide. */
  configured: boolean;
}

const AuthContext = createContext<AuthState>({ user: null, loading: true, configured: false });

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    // Finish a redirect-based Google sign-in, if one is in flight.
    completeRedirectSignIn();
    const unsubscribe = subscribeToAuth(u => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, configured: isFirebaseConfigured }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthState => useContext(AuthContext);
