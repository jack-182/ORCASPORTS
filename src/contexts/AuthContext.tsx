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
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
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

  // Firebase Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setEmailVerified(Boolean(user?.emailVerified));

      if (user && user.emailVerified) {
        try {
          await syncUserOnSignIn(user);
        } catch (err) {
          console.error('Failed to sync profile on sign-in:', err);
        }
      } else if (!user) {
        setUserProfile(null);
        setUserPrivate(null);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Auto-request browser geolocation once signed in
  useEffect(() => {
    if (firebaseUser && emailVerified && geoStatus === 'idle') {
      requestGeolocation();
    }
  }, [firebaseUser, emailVerified, geoStatus, requestGeolocation]);

  // Attach real-time Firestore listeners for userProfile & userPrivate ONLY when authenticated & verified
  useEffect(() => {
    if (!authReady || !firebaseUser || !emailVerified) return;

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
  }, [authReady, firebaseUser, emailVerified]);

  // Real online presence & GPS coordinates heartbeat
  useEffect(() => {
    if (!firebaseUser || !emailVerified) return;

    const uid = firebaseUser.uid;
    void updateOnlinePresence(uid, true, coordsRef.current);

    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void updateOnlinePresence(uid, true, coordsRef.current);
      }
    }, 45000);

    const handleVisibility = () => {
      void updateOnlinePresence(
        uid,
        document.visibilityState === 'visible',
        coordsRef.current
      );
    };

    const handleBeforeUnload = () => {
      void updateOnlinePresence(uid, false, coordsRef.current);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [firebaseUser, emailVerified]);

  // Sync newly detected city into user profile if empty
  useEffect(() => {
    if (firebaseUser && emailVerified && detectedCity && userProfile && !userProfile.city) {
      void updateUserProfile(firebaseUser.uid, { city: detectedCity }).catch(() => undefined);
    }
  }, [firebaseUser, emailVerified, detectedCity, userProfile]);

  // Push real GPS coordinates whenever coords change and shareLocation is active
  useEffect(() => {
    if (firebaseUser && emailVerified && coords && userProfile?.shareLocation !== false) {
      void updateOnlinePresence(firebaseUser.uid, true, coords);
    }
  }, [firebaseUser, emailVerified, coords, userProfile?.shareLocation]);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const cred = await signInWithPopup(auth, provider);
    setEmailVerified(Boolean(cred.user.emailVerified));
    if (cred.user.emailVerified) {
      await syncUserOnSignIn(cred.user);
    }
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    setEmailVerified(Boolean(cred.user.emailVerified));
    if (cred.user.emailVerified) {
      await syncUserOnSignIn(cred.user);
    }
  }, []);

  const signUpWithEmail = useCallback(
    async (name: string, email: string, password: string) => {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: name.trim() });
      await sendEmailVerification(cred.user);
      setEmailVerified(Boolean(cred.user.emailVerified));
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
