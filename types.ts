
export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum UserStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export type WeekRange = '1_WEEK' | '2_WEEKS' | '1_MONTH';

export interface User {
  id: string;
  name: string;
  mobile?: string;
  email?: string;
  role: Role;
  status: UserStatus;
}

export interface Shift {
  id: string;
  name: string;
  slots: number;
}

export interface Leave {
  id: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  shiftId: string;
  shiftName: string;
  status: LeaveStatus;
  createdAt: string;
}

export interface Config {
  disabledDays: number[]; // 0 for Sunday, 6 for Saturday
  weekRange: WeekRange;
  shifts: Shift[];
}

export interface LeaveSlotInfo {
  date: string;
  shiftId: string;
  totalSlots: number;
  filledSlots: number;
  availableSlots: number;
}