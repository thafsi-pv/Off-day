
import { useQuery, useMutation, useQueryClient, UseQueryOptions, UseMutationOptions } from '@tanstack/react-query';
import * as api from '../services/api';
import { User, UserStatus, Role } from '../types';

// FIX: The useAllUsers hook was called with arguments in AdminDashboard.tsx, but it was defined to take none.
// This updates it to accept react-query options to support conditional fetching.
export const useAllUsers = (options?: Omit<UseQueryOptions<User[]>, 'queryKey' | 'queryFn'>) => {
  return useQuery<User[]>({
    queryKey: ['users', 'all'],
    queryFn: api.getAllUsers,
    ...options,
  });
};

export const useUpdateUserStatusMutation = (options?: any) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { userId: string, status: UserStatus }) =>
      api.updateUserStatus(variables.userId, variables.status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
    },
    ...options
  });
};

export const useResetUserPasswordMutation = (options?: any) => {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; newPassword?: string; message: string }, Error, { userId: string, newPassword?: string }>({
    mutationFn: (variables) =>
      api.resetUserPassword(variables.userId, variables.newPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
    },
    ...options
  });
};

type UpdateUserData = {
  userId: string;
  name?: string;
  mobile?: string;
  email?: string;
  status?: string;
  role?: Role;
  allowedTabs?: string[];
};

type UseUpdateUserMutationOptions = Omit<UseMutationOptions<User, any, UpdateUserData>, 'mutationFn'>;

export const useUpdateUserMutation = (options?: UseUpdateUserMutationOptions) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...data }: UpdateUserData) => api.updateUser(userId, data),
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
    },
  });
};

export const useDeleteUserMutation = (options?: any) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { userId: string }) => api.deleteUserById(variables.userId),
    ...options,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
    },
  });
};