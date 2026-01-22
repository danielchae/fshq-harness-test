// User and role types for authentication and authorization

export type UserRole = 'admin' | 'manager' | 'fan' | 'commissioner';

export interface User {
  id: string;
  name?: string;
  email?: string;
  image?: string;
  role: UserRole;
}

export interface UserContextValue {
  user: User | null;
  isLoading: boolean;
  isAdmin: boolean;
}
