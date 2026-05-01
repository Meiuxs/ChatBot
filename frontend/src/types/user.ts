export interface User {
  email: string
  password?: string
  createdAt?: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  loading: boolean
}
