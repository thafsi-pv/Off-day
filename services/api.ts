
import axios from 'axios';
import { User, Config, Leave, LeaveStatus, LeaveSlotInfo, UserStatus } from '../types';

// Get API URL from environment variable, fallback to default for development
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const API_PREFIX = '/api';

const apiClient = axios.create({
  baseURL: `${API_URL}${API_PREFIX}`,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false, // Set to true if using cookies for authentication
});

// Auth
// export const login = (credentials: { email: string, password: string }): Promise<User> => apiClient.post('/auth/login', credentials).then(res => res.data);
// export const register = (data: { name: string, email: string, password: string }): Promise<User> => apiClient.post('/auth/register', data).then(res => res.data);

// LOGIN —
export const login = (credentials: { mobile: string; password: string }): Promise<User> =>
  apiClient.post('/auth/login', credentials).then((res) => res.data);

// REGISTER — now includes mobile + optional email
export const register = (data: { name: string; mobile: string; email?: string | null; password: string }): Promise<User> =>
  apiClient.post('/auth/register', data).then((res) => res.data);


// Users
export const getAllUsers = (): Promise<User[]> => apiClient.get('/users').then(res => res.data);
export const updateUserStatus = (userId: string, status: UserStatus): Promise<User> => apiClient.patch(`/users/${userId}/status`, { status }).then(res => res.data);
export const resetUserPassword = (userId: string, newPassword?: string): Promise<{ success: boolean; newPassword?: string; message: string }> =>
  apiClient.post(`/users/${userId}/reset-password`, { newPassword }).then(res => res.data);
export const updateUser = (id: string, data: { name?: string; mobile?: string; email?: string; status?: string }) =>
  apiClient.patch(`/users/${id}`, data).then((res) => res.data);
export const deleteUserById = (id: string): Promise<{ success: boolean; message: string }> =>
  apiClient.delete(`/users/${id}`).then((res) => res.data);

// Config
export const getConfig = (): Promise<Config> => apiClient.get('/config').then(res => res.data);
export const updateConfig = (config: Partial<Config>): Promise<Config> => apiClient.put('/config', config).then(res => res.data);

// Leaves
export const getAllLeaves = (): Promise<Leave[]> => apiClient.get('/leaves').then(res => res.data);
export const getLeavesForUser = (userId: string): Promise<Leave[]> => apiClient.get(`/leaves/user/${userId}`).then(res => res.data);
export const createLeave = (data: { userId: string, date: string, shiftId: string }): Promise<Leave> => apiClient.post('/leaves', data).then(res => res.data);
export const updateLeaveStatus = (leaveId: string, status: LeaveStatus.APPROVED | LeaveStatus.REJECTED): Promise<Leave> => apiClient.patch(`/leaves/${leaveId}/status`, { status }).then(res => res.data);
export const updateMultipleLeaveStatuses = (leaveIds: string[], status: LeaveStatus.APPROVED | LeaveStatus.REJECTED): Promise<Leave[]> =>
  apiClient.patch(`/leaves/status/bulk`, { leaveIds, status }).then(res => res.data);
export const cancelLeave = (leaveId: string): Promise<Leave> => apiClient.delete(`/leaves/${leaveId}`).then(res => res.data);

// Slots
export const getSlotInfoForDate = (date: string): Promise<LeaveSlotInfo[]> => apiClient.get(`/leaves/slots/date/${date}`).then(res => res.data);
export const getSlotInfoForDateRange = (startDate: string, endDate: string): Promise<{ [date: string]: { availableSlots: number; totalSlots: number; } }> => apiClient.get(`/leaves/slots/range?startDate=${startDate}&endDate=${endDate}`).then(res => res.data);