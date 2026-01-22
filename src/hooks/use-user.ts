'use client';

import { useEffect, useState } from 'react';

import type { User } from '@/types/user';

// MOCK: Backend will replace with actual session/auth check
// This hook determines user role for role-based UI rendering
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Fetch user info from API (which can read httpOnly cookies)
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/user/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUser();
  }, []);

  const isAdmin = user?.role === 'admin' || user?.role === 'commissioner';

  return { user, isLoading, isAdmin };
}
