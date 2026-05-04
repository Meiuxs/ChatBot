export interface User {
  email: string
  createdAt?: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
}
