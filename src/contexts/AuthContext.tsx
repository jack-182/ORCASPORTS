import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  reverseGeocodeCoords,
  syncUserOnSignIn,
  updateOnlinePresence,
  updateUserProfile,
} from '../services/firestoreService';
import type { GeoCoordinates, UserPrivate, UserPublic } from '../types/orca';

type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  userProfile: UserPublic | null;
  userPrivate: UserPrivate | null;
  authReady: boolean;
  emailVerified: boolean;
  authRedirectError: unknown | null;
  isNetworkOnline: boolean;
  coords: GeoCoordinates | null;
  geoStatus: GeoStatus;
  detectedCity: string;
  requestGeolocation: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (name: string, email: string, password: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserPublic | null>(null);
  const [userPrivate, setUserPrivate] = useState<UserPrivate | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [authRedirectError, setAuthRedirectError] = useState<unknown | null>(null);
  const [isNetworkOnline, setIsNetworkOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsNetworkOnline(true);
    const handleOffline = () => setIsNetworkOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [coords, setCoords] = useState<GeoCoordinates | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [detectedCity, setDetectedCity] = useState('');

  const coordsRef = useRef<GeoCoordinates | null>(null);
  coordsRef.current = coords;

  const requestGeolocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setGeoStatus('unsupported');
      return;
    }
    setGeoStatus('requesting');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const next: GeoCoordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          updatedAtMs: Date.now(),
        };
        setCoords(next);
        setGeoStatus('granted');
        const city = await reverseGeocodeCoords(next.lat, next.lng);
        if (city) setDetectedCity(city);
      },
      () => {
        setGeoStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  // Watch real GPS position when permission is granted
  useEffect(() => {
    if (geoStatus !== 'granted' || !('geolocation' in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          updatedAtMs: Date.now(),
        });
      },
      () => undefined,
      { enableHighAccuracy: false, maximumAge: 30000, timeout: 15000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [geoStatus]);

  // Handle redirect auth result when returning from signInWithRedirect fallback
  useEffect(() => {
    void getRedirectResult(auth)
      .then((result) => {
        if (result?.user && (typeof navigator === 'undefined' || navigator.onLine)) {
          void syncUserOnSignIn(result.user).catch((err) => {
            console.warn('Redirect profile sync warning:', err);
          });
        }
      })
      .catch((err) => {
        setAuthRedirectError(err);
      });
  }, []);

  // Firebase Auth state listener (non-blocking so offline cached sessions open immediately)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setEmailVerified(Boolean(user?.emailVerified));
      setAuthReady(true);

      if (user) {
        if (typeof navigator === 'undefined' || navigator.onLine) {
          void syncUserOnSignIn(user).catch((err) => {
            console.warn('Profile sync deferred (offline or transient):', err);
          });
        }
      } else {
        setUserProfile(null);
        setUserPrivate(null);
      }
    });
    return () => unsub();
  }, []);

  // Auto-request browser geolocation once signed in
  useEffect(() => {
    if (firebaseUser && geoStatus === 'idle') {
      requestGeolocation();
    }
  }, [firebaseUser, geoStatus, requestGeolocation]);

  // Attach real-time Firestore listeners for userProfile & userPrivate ONLY when authenticated
  useEffect(() => {
    if (!authReady || !firebaseUser) return;

    const publicRef = doc(db, 'users', firebaseUser.uid);
    const privateRef = doc(db, 'users_private', firebaseUser.uid);

    const unsubPublic = onSnapshot(
      publicRef,
      (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserPublic);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
      }
    );

    const unsubPrivate = onSnapshot(
      privateRef,
      (snap) => {
        if (snap.exists()) {
          setUserPrivate(snap.data() as UserPrivate);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `users_private/${firebaseUser.uid}`);
      }
    );

    return () => {
      unsubPublic();
      unsubPrivate();
    };
  }, [authReady, firebaseUser]);

  // Real online presence & GPS coordinates heartbeat (skipped while offline)
  useEffect(() => {
    if (!firebaseUser || !isNetworkOnline) return;

    const uid = firebaseUser.uid;
    void updateOnlinePresence(uid, true, coordsRef.current);

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible' && navigator.onLine) {
        void updateOnlinePresence(uid, true, coordsRef.current);
      }
    }, 45000);

    const handleVisibility = () => {
      if (!navigator.onLine) return;
      void updateOnlinePresence(
        uid,
        document.visibilityState === 'visible',
        coordsRef.current
      );
    };

    const handleBeforeUnload = () => {
      if (!navigator.onLine) return;
      void updateOnlinePresence(uid, false, coordsRef.current);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [firebaseUser, isNetworkOnline]);

  // Sync newly detected city into user profile if empty
  useEffect(() => {
    if (firebaseUser && detectedCity && userProfile && !userProfile.city) {
      void updateUserProfile(firebaseUser.uid, { city: detectedCity }).catch(() => undefined);
    }
  }, [firebaseUser, detectedCity, userProfile]);

  // Push real GPS coordinates whenever coords change and shareLocation is active
  useEffect(() => {
    if (firebaseUser && coords && userProfile?.shareLocation !== false) {
      void updateOnlinePresence(firebaseUser.uid, true, coords);
    }
  }, [firebaseUser, coords, userProfile?.shareLocation]);

  const signInWithGoogle = useCallback(async () => {
    setAuthRedirectError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const cred = await signInWithPopup(auth, provider);
      setEmailVerified(Boolean(cred.user.emailVerified));
      if (typeof navigator === 'undefined' || navigator.onLine) {
        void syncUserOnSignIn(cred.user).catch((err) => {
          console.warn('Google profile sync warning:', err);
        });
      }
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      const isInIframe = typeof window !== 'undefined' && window.self !== window.top;
      if (
        !isInIframe &&
        (code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment')
      ) {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw err;
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setAuthRedirectError(null);
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    setEmailVerified(Boolean(cred.user.emailVerified));
    if (typeof navigator === 'undefined' || navigator.onLine) {
      void syncUserOnSignIn(cred.user).catch((err) => {
        console.warn('Email profile sync warning:', err);
      });
    }
  }, []);

  const signUpWithEmail = useCallback(
    async (name: string, email: string, password: string) => {
      setAuthRedirectError(null);
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() }).catch(() => undefined);
      setEmailVerified(Boolean(cred.user.emailVerified));
      if (typeof navigator === 'undefined' || navigator.onLine) {
        void syncUserOnSignIn(cred.user, name.trim()).catch((err) => {
          console.warn('Signup profile sync warning:', err);
        });
      }
      void sendEmailVerification(cred.user).catch(() => undefined);
    },
    []
  );

  const signInWithApple = useCallback(async () => {
    const provider = new OAuthProvider('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    const cred = await signInWithPopup(auth, provider);
    setEmailVerified(Boolean(cred.user.emailVerified));
    if (cred.user.emailVerified) {
      await syncUserOnSignIn(cred.user);
    }
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser);
    }
  }, []);

  const refreshAuthUser = useCallback(async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const verified = Boolean(auth.currentUser.emailVerified);
    setEmailVerified(verified);
    if (verified) {
      await syncUserOnSignIn(auth.currentUser);
    }
    return verified;
  }, []);

  const logout = useCallback(async () => {
    if (auth.currentUser) {
      await updateOnlinePresence(auth.currentUser.uid, false, coordsRef.current);
    }
    await signOut(auth);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      userProfile,
      userPrivate,
      authReady,
      emailVerified,
      authRedirectError,
      isNetworkOnline,
      coords,
      geoStatus,
      detectedCity,
      requestGeolocation,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signInWithApple,
      sendPasswordReset,
      resendVerificationEmail,
      refreshAuthUser,
      logout,
    }),
    [
      firebaseUser,
      userProfile,
      userPrivate,
      authReady,
      emailVerified,
      authRedirectError,
      isNetworkOnline,
      coords,
      geoStatus,
      detectedCity,
      requestGeolocation,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signInWithApple,
      sendPasswordReset,
      resendVerificationEmail,
      refreshAuthUser,
      logout,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
