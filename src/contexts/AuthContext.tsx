'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User,
  updateProfile,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { userService } from '@/lib/userService';
import { useToast } from './ToastContext';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('Signed in successfully!', 'success');
    } catch (error: any) {
      console.error('Sign in error:', error);
      const message = error.code === 'auth/invalid-credential' 
        ? 'Invalid email or password' 
        : error.message || 'Failed to sign in';
      showToast(message, 'error');
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (result.user) {
        await updateProfile(result.user, { displayName: name });
        // Create user profile in Firestore
        await userService.createUserProfile(result.user.uid, email, name);
        showToast('Account created successfully!', 'success');
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      const message = error.code === 'auth/email-already-in-use' 
        ? 'Email already in use' 
        : error.message || 'Failed to create account';
      showToast(message, 'error');
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        // Check if user profile exists, if not create one
        const existingProfile = await userService.getUserProfile(result.user.uid);
        if (!existingProfile) {
          await userService.createUserProfile(
            result.user.uid,
            result.user.email || '',
            result.user.displayName || 'User',
            result.user.photoURL || undefined
          );
        }
        showToast('Signed in with Google!', 'success');
      }
    } catch (error: any) {
      console.error('Google sign in error:', error);
      showToast(error.message || 'Failed to sign in with Google', 'error');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      showToast('Logged out successfully', 'success');
    } catch (error: any) {
      console.error('Logout error:', error);
      showToast('Failed to logout', 'error');
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
