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

  // 사용자 상태 확인 및 프로필 자동 생성 로직
  const checkUserStatus = useCallback(async (sessionUser: any | null, force: boolean = false) => {
    const userId = sessionUser?.id || null;
    
    // 이미 처리된 사용자라면 중복 실행 방지
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
        // 1. 프로필 조회 시도
        let profile = await getUserProfile(sessionUser.id);

        // 2. 프로필이 없거나(null) 이메일이 누락된 경우 -> DB에 자동 생성(Upsert)
        // 구글 로그인 등으로 처음 들어왔을 때 profiles 테이블에 row가 없으면 여기서 생성함
        if (!profile || !profile.email) {
            console.log("Creating missing profile for user:", sessionUser.email);
            if (supabase) {
                const { error: upsertError } = await supabase.from('profiles').upsert({
                    id: sessionUser.id,
                    email: sessionUser.email,
                    tier_id: 'free',
                    role: 'user',
                    updated_at: new Date().toISOString()
                });
                
                if (!upsertError) {
                    // 생성 후 다시 조회하여 최신 정보 반영
                    profile = await getUserProfile(sessionUser.id);
                } else {
                    console.error("Failed to create profile automatically:", upsertError);
                }
            }
        }
        
        // 관리자 권한 확인 (하드코딩된 이메일 또는 DB 역할)
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
          // 1. 현재 세션 가져오기
          const { data: { session } } = await supabase.auth.getSession();
          if (mounted) {
            await checkUserStatus(session?.user ?? null);
          }
        } catch (e) {
          console.error("Session init failed", e);
          if (mounted) setLoading(false);
        }

        // 2. 인증 상태 변경 감지 (로그인, 로그아웃 등)
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

          // 세션 사용자가 변경되었을 때만 상태 재확인
          if (session?.user?.id !== lastProcessedUserId.current) {
              await checkUserStatus(session?.user ?? null);
          }
        });

        return () => {
          mounted = false;
          subscription.unsubscribe();
        };
      } else {
        // Supabase 미설정 시 데모 모드
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