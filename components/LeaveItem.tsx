
import React from 'react';
import { Leave, LeaveStatus } from '../types';
import { Button } from './ui';
import { FaRegTrashAlt } from "react-icons/fa";
// import { TrashIcon } from './icons';

const getStatusBadge = (status: LeaveStatus) => {
    switch (status) {
        case LeaveStatus.APPROVED:
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case LeaveStatus.REJECTED:
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
        case LeaveStatus.PENDING:
        default:
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    }
};

const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    });
};

interface LeaveItemProps {
  leave: Leave;
  onCancel?: (leaveId: string) => void;
  isNextActive?: boolean;
  isActionLoading?: boolean;
}

const LeaveItem: React.FC<LeaveItemProps> = ({ leave, onCancel, isNextActive, isActionLoading }) => {
  const isCancellable = leave.status === LeaveStatus.PENDING && onCancel;

  return (
    <div className={`flex items-center justify-between p-4 border-b border-border last:border-b-0 transition-colors ${isNextActive ? 'bg-primary/10' : ''}`}>
      <div>
        <p className="font-semibold">{formatDate(leave.date)}</p>
        <p className="text-sm text-muted-foreground">{leave.shiftName}</p>
      </div>
      <div className="flex items-center gap-2">
        <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusBadge(leave.status)}`}>
          {leave.status}
        </span>
        {isCancellable && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCancel(leave.id)}
            disabled={isActionLoading}
            aria-label={`Cancel leave request for ${formatDate(leave.date)}`}
          >
            <FaRegTrashAlt className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default LeaveItem;
