
export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
  SHIFT_MANAGER = 'SHIFT_MANAGER',
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
  startTime?: string;
  endTime?: string;
}

export interface Leave {
  id: string;
  userId: string;
  userName: string;
  userMobile?: string;
  creatorId?: string;
  date: string; // YYYY-MM-DD
  shiftId: string;
  shiftName: string;
  status: LeaveStatus;
  reason?: string;
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