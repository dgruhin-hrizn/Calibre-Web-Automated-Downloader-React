import { useState } from 'react';
import type { User, UserDetails, CreateUserData } from '../types/user';

// Re-export types for backward compatibility
export type { User, UserDetails, CreateUserData } from '../types/user';

export const useUserManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/useradmin/users', {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch users');
        return;
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      setError('Network error fetching users');
    } finally {
      setIsLoading(false);
    }
  };

  const getUserDetails = async (userId: string): Promise<UserDetails | null> => {
    try {
      const response = await fetch(`/api/useradmin/users/${userId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch user details');
        return null;
      }

      return await response.json();
    } catch (err) {
      setError('Network error fetching user details');
      return null;
    }
  };

  const createUser = async (userData: CreateUserData): Promise<boolean> => {
    setError(null);

    try {
      const response = await fetch('/api/useradmin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create user');
        return false;
      }

      // Refresh users list
      await fetchUsers();
      return true;
    } catch (err) {
      setError('Network error creating user');
      return false;
    }
  };

  const updateUser = async (userId: string, userData: Partial<UserDetails>): Promise<boolean> => {
    setError(null);

    try {
      const response = await fetch(`/api/useradmin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update user');
        return false;
      }

      // Refresh users list
      await fetchUsers();
      return true;
    } catch (err) {
      setError('Network error updating user');
      return false;
    }
  };

  const deleteUser = async (userId: string): Promise<boolean> => {
    setError(null);

    try {
      const response = await fetch(`/api/useradmin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete user');
        return false;
      }

      // Refresh users list
      await fetchUsers();
      return true;
    } catch (err) {
      setError('Network error deleting user');
      return false;
    }
  };

  return {
    users,
    isLoading,
    error,
    fetchUsers,
    getUserDetails,
    createUser,
    updateUser,
    deleteUser
  };
};
