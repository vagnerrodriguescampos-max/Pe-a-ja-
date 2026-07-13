import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  usuario: { id: string; nome: string; email: string; papel: string; loja_id: string } | null;
  setAuth: (token: string, usuario: any) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      usuario: null,
      setAuth: (token, usuario) => {
        localStorage.setItem('admin_token', token);
        set({ token, usuario });
      },
      logout: () => {
        localStorage.removeItem('admin_token');
        set({ token: null, usuario: null });
      },
      isAuthenticated: () => !!get().token,
    }),
    { name: 'auth' },
  ),
);
