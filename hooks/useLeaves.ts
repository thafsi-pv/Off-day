import { useQuery, useMutation, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
// FIX: Changed import to use namespace import since `api.ts` exports individual functions.
import * as api from '../services/api';
import { Leave, LeaveStatus, LeaveSlotInfo } from '../types';

// Fetch all leaves (for admin)
export const useAllLeaves = () => {
    // FIX: Added generic type to useQuery to ensure data is typed correctly.
    return useQuery<Leave[]>({
        queryKey: ['leaves', 'all'],
        queryFn: api.getAllLeaves,
    });
};

// Fetch leaves for a specific user
export const useUserLeaves = (userId: string) => {
    // FIX: Added generic type to useQuery to ensure data is typed correctly.
    return useQuery<Leave[]>({
        queryKey: ['leaves', 'user', userId],
        queryFn: () => api.getLeavesForUser(userId),
        enabled: !!userId,
    });
};

// Fetch slot info for a single date
export const useSlotInfoForDate = (date: string, options?: Omit<UseQueryOptions<LeaveSlotInfo[]>, 'queryKey' | 'queryFn'>) => {
    // FIX: Added generic type to useQuery to ensure data is typed correctly.
    return useQuery<LeaveSlotInfo[]>({
        queryKey: ['slots', 'date', date],
        queryFn: () => api.getSlotInfoForDate(date),
        ...options
    });
};

// Fetch slot info for a date range
export const useSlotInfoForDateRange = (
    range: { startDate: string; endDate: string } | null,
    options?: Omit<UseQueryOptions<{ [date: string]: { availableSlots: number; totalSlots: number; } }>, 'queryKey' | 'queryFn'>
) => {
    // FIX: Added generic type to useQuery to ensure data is typed correctly.
    return useQuery<{ [date: string]: { availableSlots: number; totalSlots: number; } }>({
        queryKey: ['slots', 'range', range],
        queryFn: () => api.getSlotInfoForDateRange(range!.startDate, range!.endDate),
        enabled: !!range,
        ...options
    });
};

// Create a new leave request
export const useCreateLeaveMutation = (options?: any) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { userId: string, date: string, shiftId: string, status?: LeaveStatus, creatorId?: string }) => api.createLeave(data),
        onSuccess: (data: Leave) => {
            queryClient.invalidateQueries({ queryKey: ['leaves', 'user', data.userId] });
            queryClient.invalidateQueries({ queryKey: ['slots'] });
        },
        ...options,
    });
};

// Update leave status (for admin)
export const useUpdateLeaveStatusMutation = (options?: any) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables: { leaveId: string, status: LeaveStatus.APPROVED | LeaveStatus.REJECTED, reason?: string }) =>
            api.updateLeaveStatus(variables.leaveId, variables.status, variables.reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leaves', 'all'] });
            queryClient.invalidateQueries({ queryKey: ['slots'] });
        },
        ...options
    });
};

// Update multiple leave statuses (for admin bulk action)
export const useUpdateMultipleLeaveStatusesMutation = (options?: any) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (variables: { leaveIds: string[], status: LeaveStatus.APPROVED | LeaveStatus.REJECTED }) =>
            api.updateMultipleLeaveStatuses(variables.leaveIds, variables.status),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leaves', 'all'] });
            queryClient.invalidateQueries({ queryKey: ['slots'] });
        },
        ...options
    });
};

// Cancel a leave request (for users)
export const useCancelLeaveMutation = (options?: any) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (leaveId: string) => api.cancelLeave(leaveId),
        onSuccess: (data: Leave) => {
            queryClient.invalidateQueries({ queryKey: ['leaves', 'user', data.userId] });
            queryClient.invalidateQueries({ queryKey: ['leaves', 'all'] });
            queryClient.invalidateQueries({ queryKey: ['slots'] });
        },
        ...options
    });
};