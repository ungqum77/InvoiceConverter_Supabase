import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../services/supabase';
import { getUserProfile } from '../services/dbService';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isDeletedAccount: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeletedAccount, setIsDeletedAccount] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  
  const lastProcessedUserId = useRef<string | null>(null);
  const isCheckingRef = useRef<boolean>(false);

  const checkUserStatus = useCallback(async (sessionUser: any | null, force: boolean = false) => {
    const userId = sessionUser?.id || null;
    
    if (!force && userId === lastProcessedUserId.current && !isCheckingRef.current) {
        setLoading(false);
        return;
    }

    if (!sessionUser) {
      lastProcessedUserId.current = null;
      setUser(null);
      setIsDeletedAccount(false);
      setIsAdmin(false);
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    isCheckingRef.current = true;
    try {
        // DB 응답 대기 시간을 5초로 조정하여 안정성 확보
        const profilePromise = getUserProfile(sessionUser.id);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("AUTH_DB_TIMEOUT")), 5000)
        );
        
        const profile: any = await Promise.race([profilePromise, timeoutPromise]).catch(err => {
            console.warn("Auth check failed or timed out:", err);
            return null;
        });
        
        const HARDCODED_ADMINS = ['ungqum77@gmail.com'];
        const userEmail = sessionUser.email || '';
        const isHardcodedAdmin = HARDCODED_ADMINS.includes(userEmail);

        setIsSuperAdmin(profile?.role === 'super_admin' || isHardcodedAdmin);
        setIsAdmin(profile?.role === 'super_admin' || profile?.role === 'admin' || isHardcodedAdmin);
        setIsDeletedAccount(sessionUser.user_metadata?.status === 'deleted');
        
        lastProcessedUserId.current = userId;
        setUser(sessionUser as User);
    } catch (e) {
        console.error("Critical auth check error:", e);
    } finally {
        isCheckingRef.current = false;
        setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (mounted) {
            await checkUserStatus(session?.user ?? null);
          }
        } catch (e) {
          console.error("Session init failed", e);
          if (mounted) setLoading(false);
        }

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return;
          
          if (event === 'SIGNED_OUT') {
              lastProcessedUserId.current = null;
              setUser(null);
              setIsDeletedAccount(false);
              setIsAdmin(false);
              setIsSuperAdmin(false);
              setLoading(false);
              return;
          }

          if (session?.user?.id !== lastProcessedUserId.current) {
              await checkUserStatus(session?.user ?? null);
          }
        });

        return () => {
          mounted = false;
          subscription.unsubscribe();
        };
      } else {
        const storedUser = localStorage.getItem('demo_user');
        if (storedUser && mounted) {
          try {
            await checkUserStatus(JSON.parse(storedUser));
          } catch (e) {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
        return () => { mounted = false; };
      }
    };

    initAuth();
  }, [checkUserStatus]);

  const refreshUser = async () => {
    if (supabase) {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      await checkUserStatus(currentUser, true);
    }
  };

  const signOut = async () => {
    try {
        setLoading(true);
        if (supabase) {
          await supabase.auth.signOut();
        }
    } catch (e) {
        console.error("SignOut error", e);
    } finally {
        localStorage.removeItem('demo_user');
        lastProcessedUserId.current = null;
        setUser(null);
        setIsDeletedAccount(false);
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isDeletedAccount, isAdmin, isSuperAdmin, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};