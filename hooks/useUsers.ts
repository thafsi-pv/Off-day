
import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import * as api from '../services/api';
import { User, UserStatus } from '../types';

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
    return useMutation({
        mutationFn: (variables: { userId: string, newPassword?: string }) =>
            api.resetUserPassword(variables.userId, variables.newPassword),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users', 'all'] });
        },
        ...options
    });
};