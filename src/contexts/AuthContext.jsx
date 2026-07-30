import { createContext, useContext, useEffect, useState } from 'react'

const AuthContext = createContext()

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        // Check localStorage on mount
        const storedUser = localStorage.getItem('hr_user')
        if (storedUser) {
            try {
                setUser(JSON.parse(storedUser))
            } catch (e) {
                console.error('Failed to parse user from local storage', e)
                localStorage.removeItem('hr_user')
            }
        }
        setLoading(false)
    }, [])

    const login = (userData) => {
        setUser(userData)
        localStorage.setItem('hr_user', JSON.stringify(userData))
    }

    const logout = () => {
        setUser(null)
        localStorage.removeItem('hr_user')
    }

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    )
}

export const useAuth = () => useContext(AuthContext)
