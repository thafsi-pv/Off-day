
import React, { useState, useEffect, useMemo } from 'react';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Bar } from 'recharts';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { User, Config, Leave, LeaveStatus, Shift, UserStatus } from '../types';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Select, Tabs, TabsContent, TabsList, TabsTrigger } from './ui';
import { BarChartIcon, ListIcon, SettingsIcon, DownloadIcon, UsersIcon, KeyIcon } from './icons';
import { useAllLeaves, useUpdateLeaveStatusMutation, useUpdateMultipleLeaveStatusesMutation } from '../hooks/useLeaves';
import { useConfig, useUpdateConfigMutation } from '../hooks/useConfig';
import { useAllUsers, useUpdateUserStatusMutation, useResetUserPasswordMutation } from '../hooks/useUsers';

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
    return new Date(dateString).toLocaleDateString('en-CA', { timeZone: 'UTC' });
};

const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-muted ${className}`} />
);

const Analytics: React.FC<{ leaves: Leave[], shifts: Shift[] }> = ({ leaves, shifts }) => {
    const data = useMemo(() => {
        const leaveCountsByDay: { [date: string]: { name: string; [shiftId: string]: any } } = {};
        
        leaves.filter(l => l.status === LeaveStatus.APPROVED || l.status === LeaveStatus.PENDING).forEach(leave => {
            if (!leaveCountsByDay[leave.date]) {
                leaveCountsByDay[leave.date] = { name: formatDate(leave.date) } as any;
                shifts.forEach(s => leaveCountsByDay[leave.date][s.id] = 0);
            }
            leaveCountsByDay[leave.date][leave.shiftId]++;
        });

        return Object.values(leaveCountsByDay).sort((a,b) => a.name.localeCompare(b.name));
    }, [leaves, shifts]);

    return (
        <Card>
            <CardHeader>
                <CardTitle>Leave Analytics</CardTitle>
                <CardDescription>Overview of approved and pending leaves per day.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            {shifts.map((shift, index) => (
                                <Bar key={shift.id} dataKey={shift.id} name={shift.name} fill={`hsl(220, 80%, ${60 + index * 10}%)`} />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
};

const LeaveManagement: React.FC<{
    leaves: Leave[],
    onStatusChange: (leaveId: string, status: LeaveStatus.APPROVED | LeaveStatus.REJECTED) => void,
    onBulkStatusChange: (variables: { leaveIds: string[], status: LeaveStatus.APPROVED | LeaveStatus.REJECTED }) => void,
    isActionLoading: boolean,
}> = ({ leaves, onStatusChange, onBulkStatusChange, isActionLoading }) => {
    const [filterStatus, setFilterStatus] = useState<LeaveStatus | 'ALL'>(LeaveStatus.PENDING);
    const [selectedLeaves, setSelectedLeaves] = useState<string[]>([]);

    const filteredLeaves = useMemo(() => {
        return leaves
            .filter(l => filterStatus === 'ALL' || l.status === filterStatus)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [leaves, filterStatus]);
    
    const selectableLeaves = useMemo(() => 
        filteredLeaves.filter(l => l.status === LeaveStatus.PENDING),
        [filteredLeaves]
    );
    
    useEffect(() => {
        // Clear selection when filter changes
        setSelectedLeaves([]);
    }, [filterStatus]);

    const handleToggleSelect = (leaveId: string) => {
        setSelectedLeaves(prev => 
            prev.includes(leaveId) ? prev.filter(id => id !== leaveId) : [...prev, leaveId]
        );
    };

    const handleToggleSelectAll = () => {
        if (selectedLeaves.length === selectableLeaves.length) {
            setSelectedLeaves([]);
        } else {
            setSelectedLeaves(selectableLeaves.map(l => l.id));
        }
    };
    
    const handleBulkAction = (status: LeaveStatus.APPROVED | LeaveStatus.REJECTED) => {
        onBulkStatusChange({ leaveIds: selectedLeaves, status });
        setSelectedLeaves([]);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Manage Leave Requests</CardTitle>
                <div className="flex justify-between items-center">
                    <CardDescription>Approve or reject leave requests.</CardDescription>
                    <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="w-48">
                        <option value="ALL">All Statuses</option>
                        <option value={LeaveStatus.PENDING}>Pending</option>
                        <option value={LeaveStatus.APPROVED}>Approved</option>
                        <option value={LeaveStatus.REJECTED}>Rejected</option>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                {selectedLeaves.length > 0 && (
                    <div className="p-4 bg-muted border-b rounded-t-lg flex items-center gap-4">
                        <p className="text-sm font-semibold flex-grow">{selectedLeaves.length} selected</p>
                        <Button size="sm" onClick={() => handleBulkAction(LeaveStatus.APPROVED)} disabled={isActionLoading}>Approve Selected</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleBulkAction(LeaveStatus.REJECTED)} disabled={isActionLoading}>Reject Selected</Button>
                    </div>
                )}
                <div className={`border rounded-lg max-h-[60vh] overflow-y-auto ${selectedLeaves.length > 0 ? 'rounded-t-none' : ''}`}>
                    {selectableLeaves.length > 0 && (
                        <div className="flex items-center p-4 border-b bg-muted/50 sticky top-0 z-10">
                            <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                checked={selectedLeaves.length > 0 && selectedLeaves.length === selectableLeaves.length}
                                onChange={handleToggleSelectAll}
                                aria-label="Select all pending requests"
                            />
                            <label htmlFor="select-all" className="ml-3 text-sm font-medium">Select all pending</label>
                        </div>
                    )}
                    {filteredLeaves.length > 0 ? filteredLeaves.map(leave => (
                        <div key={leave.id} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border-b last:border-b-0 gap-4">
                            <div className="flex items-center flex-grow">
                                <div className="w-8 flex-shrink-0">
                                {leave.status === LeaveStatus.PENDING && (
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                        checked={selectedLeaves.includes(leave.id)}
                                        onChange={() => handleToggleSelect(leave.id)}
                                        aria-labelledby={`leave-info-${leave.id}`}
                                    />
                                )}
                                </div>
                                <div id={`leave-info-${leave.id}`}>
                                    <p className="font-semibold">{leave.userName}</p>
                                    <p className="text-sm text-muted-foreground">{formatDate(leave.date)} - {leave.shiftName}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 w-full md:w-auto md:pl-8">
                                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusBadge(leave.status)}`}>
                                    {leave.status}
                                </span>
                                {leave.status === LeaveStatus.PENDING && (
                                    <div className="flex gap-2 ml-auto">
                                        <Button size="sm" variant="outline" onClick={() => onStatusChange(leave.id, LeaveStatus.APPROVED)} disabled={isActionLoading}>Approve</Button>
                                        <Button size="sm" variant="destructive" onClick={() => onStatusChange(leave.id, LeaveStatus.REJECTED)} disabled={isActionLoading}>Reject</Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )) : <p className="p-6 text-center">No leaves match the current filter.</p>}
                </div>
            </CardContent>
        </Card>
    );
};

const Reports: React.FC<{ leaves: Leave[] }> = ({ leaves }) => {
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterStatus, setFilterStatus] = useState<LeaveStatus | 'ALL'>('ALL');

    const filteredLeaves = useMemo(() => {
        return leaves.filter(leave => {
            const leaveDate = new Date(leave.date);
            if (startDate && leaveDate < new Date(startDate)) return false;
            if (endDate && leaveDate > new Date(endDate)) return false;
            if (filterStatus !== 'ALL' && leave.status !== filterStatus) return false;
            return true;
        }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [leaves, startDate, endDate, filterStatus]);

    const handleExport = (format: 'CSV' | 'PDF') => {
        if (format === 'PDF') {
            if (filteredLeaves.length === 0) {
                toast('No data to export.');
                return;
            }
            try {
                const doc = new jsPDF();

                doc.text("Leave Report", 14, 15);

                const tableColumn = ["User", "Leave Date", "Shift", "Status", "Applied On"];
                const tableRows = filteredLeaves.map(leave => [
                    leave.userName,
                    formatDate(leave.date),
                    leave.shiftName,
                    leave.status,
                    formatDate(leave.createdAt)
                ]);

                // autoTable is added to jsPDF instance by jspdf-autotable import
                (doc as any).autoTable({
                    head: [tableColumn],
                    body: tableRows,
                    startY: 20,
                });

                doc.save('leave-report.pdf');
                toast.success('PDF report downloaded successfully!');
            } catch (error) {
                console.error("PDF Export Error:", error);
                const message = error instanceof Error ? error.message : 'An unknown error occurred.';
                toast.error(`Failed to generate PDF: ${message}`);
            }
        } else {
            toast(`For export to ${format} you need to pay maaan...`);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Leave Reports</CardTitle>
                <CardDescription>View, filter, and export all leave records.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-wrap gap-4 p-4 border rounded-lg mb-4 bg-muted/50">
                    <div className="grid gap-2">
                        <Label htmlFor="start-date">Start Date</Label>
                        <Input id="start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="end-date">End Date</Label>
                        <Input id="end-date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="status-filter">Status</Label>
                        <Select id="status-filter" value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}>
                            <option value="ALL">All Statuses</option>
                            <option value={LeaveStatus.PENDING}>Pending</option>
                            <option value={LeaveStatus.APPROVED}>Approved</option>
                            <option value={LeaveStatus.REJECTED}>Rejected</option>
                        </Select>
                    </div>
                    <div className="flex items-end gap-2">
                         <Button onClick={() => handleExport('CSV')} variant="outline"><DownloadIcon className="w-4 h-4 mr-2" /> Export CSV</Button>
                         <Button onClick={() => handleExport('PDF')} variant="outline"><DownloadIcon className="w-4 h-4 mr-2" /> Export PDF</Button>
                    </div>
                </div>
                <div className="border rounded-lg max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 sticky top-0">
                            <tr>
                                <th className="p-4 font-medium">User</th>
                                <th className="p-4 font-medium">Leave Date</th>
                                <th className="p-4 font-medium">Shift</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium">Applied On</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredLeaves.length > 0 ? filteredLeaves.map(leave => (
                                <tr key={leave.id} className="border-b last:border-0">
                                    <td className="p-4">{leave.userName}</td>
                                    <td className="p-4">{formatDate(leave.date)}</td>
                                    <td className="p-4">{leave.shiftName}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(leave.status)}`}>
                                            {leave.status}
                                        </span>
                                    </td>
                                    <td className="p-4">{formatDate(leave.createdAt)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="p-6 text-center text-muted-foreground">No records match the current filters.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};

const Settings: React.FC<{ 
    config: Config, 
    onSave: (newConfig: Config) => void,
    isLoading: boolean
}> = ({ config, onSave, isLoading }) => {
    const [localConfig, setLocalConfig] = useState(config);

    useEffect(() => setLocalConfig(config), [config]);

    const handleDayToggle = (day: number) => {
        const disabledDays = localConfig.disabledDays.includes(day)
            ? localConfig.disabledDays.filter(d => d !== day)
            : [...localConfig.disabledDays, day];
        setLocalConfig({ ...localConfig, disabledDays });
    };

    const handleShiftChange = (shiftId: string, field: 'name' | 'slots', value: string | number) => {
        const newShifts = localConfig.shifts.map(s => 
            s.id === shiftId ? { ...s, [field]: field === 'slots' ? Math.max(0, Number(value)) : value } : s
        );
        setLocalConfig({ ...localConfig, shifts: newShifts });
    };

    const handleAddShift = () => {
        const newShift: Shift = { id: `s${Date.now()}`, name: 'New Shift', slots: 1 };
        setLocalConfig({ ...localConfig, shifts: [...localConfig.shifts, newShift] });
    };

    const handleRemoveShift = (shiftId: string) => {
        setLocalConfig({ ...localConfig, shifts: localConfig.shifts.filter(s => s.id !== shiftId) });
    };
    
    const handleSave = () => {
        onSave(localConfig);
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <Card>
            <CardHeader>
                <CardTitle>System Configuration</CardTitle>
                <CardDescription>Manage application settings for leaves.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label>User Date Range</Label>
                    <Select
                        value={localConfig.weekRange}
                        onChange={e => setLocalConfig({ ...localConfig, weekRange: e.target.value as Config['weekRange'] })}
                    >
                        <option value="1_WEEK">1 Week</option>
                        <option value="2_WEEKS">2 Weeks</option>
                        <option value="1_MONTH">1 Month</option>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Disabled Days for Leave</Label>
                    <div className="flex gap-2 flex-wrap">
                        {weekDays.map((day, index) => (
                            <Button 
                                key={day} 
                                variant={localConfig.disabledDays.includes(index) ? 'destructive' : 'outline'}
                                onClick={() => handleDayToggle(index)}
                            >{day}</Button>
                        ))}
                    </div>
                </div>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Label>Shifts & Slots</Label>
                        <Button size="sm" onClick={handleAddShift}>Add Shift</Button>
                    </div>
                    <div className="space-y-2">
                        {localConfig.shifts.map(shift => (
                            <div key={shift.id} className="flex items-center gap-2">
                                <Input value={shift.name} onChange={e => handleShiftChange(shift.id, 'name', e.target.value)} className="flex-grow"/>
                                <Input type="number" value={shift.slots} onChange={e => handleShiftChange(shift.id, 'slots', e.target.value)} className="w-20" min="0" />
                                <Button variant="destructive" size="icon" onClick={() => handleRemoveShift(shift.id)}>
                                  <span className="text-xl">×</span>
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>

                <Button onClick={handleSave} disabled={isLoading}>{isLoading ? 'Saving...' : 'Save Settings'}</Button>
            </CardContent>
        </Card>
    );
};

const getUserStatusBadge = (status: UserStatus) => {
    switch (status) {
        case UserStatus.ACTIVE:
            return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
        case UserStatus.INACTIVE:
            return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
        case UserStatus.PENDING:
        default:
            return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    }
};

const UserManagement: React.FC = () => {
    const { data: users, isLoading, isError } = useAllUsers();
    const updateUserStatusMutation = useUpdateUserStatusMutation();
    const resetPasswordMutation = useResetUserPasswordMutation();
    const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(null);
    const [customPassword, setCustomPassword] = useState('');
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);

    const handleUpdateUserStatus = (userId: string, status: UserStatus) => {
        toast.promise(
            updateUserStatusMutation.mutateAsync({ userId, status }),
            {
                loading: 'Updating user status...',
                success: () => `User has been updated to ${status.toLowerCase()}.`,
                error: (error: any) => error.response?.data?.message || 'Failed to update user status.',
            }
        ).catch(() => {});
    };

    const handleResetPassword = (userId: string) => {
        setResetPasswordUserId(userId);
        setCustomPassword('');
        setShowPasswordDialog(true);
    };

    // const handleConfirmResetPassword = () => {
    //     if (!resetPasswordUserId) return;
        
    //     const newPassword = customPassword.trim() || undefined;
        
    //     toast.promise(
    //         resetPasswordMutation.mutateAsync({ userId: resetPasswordUserId, newPassword }) as Promise<{ success: boolean; newPassword?: string; message: string }>,
    //         {
    //             loading: 'Resetting password...',
    //             success: (data: { success: boolean; newPassword?: string; message: string }) => {
    //                 setShowPasswordDialog(false);
    //                 setResetPasswordUserId(null);
    //                 setCustomPassword('');
    //                 if (data.newPassword) {
    //                     return `Password reset! New password: ${data.newPassword}`;
    //                 }
    //                 return data.message || 'Password has been reset successfully.';
    //             },
    //             error: (error: any) => error.response?.data?.message || 'Failed to reset password.',
    //         }
    //     ).catch(() => {});
    // };

    const handleConfirmResetPassword = async () => {
      if (!resetPasswordUserId) return;
    
      const newPassword = customPassword.trim() || undefined;
      const id = toast.loading('Resetting password...');
    
      try {
        const data = await resetPasswordMutation.mutateAsync({
          userId: resetPasswordUserId,
          newPassword,
        });
    
        setShowPasswordDialog(false);
        setResetPasswordUserId(null);
        setCustomPassword('');
    
        // Show a custom toast (won’t auto-close)
        toast.custom((t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } bg-white dark:bg-gray-900 shadow-lg rounded-xl p-4 border border-gray-200 dark:border-gray-700 flex flex-col gap-3 max-w-md`}
          >
            <p className="text-gray-800 dark:text-white font-semibold">
              ✅ Password Reset Successful
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {data.newPassword
                ? `New password: ${data.newPassword}`
                : data.message || 'Password has been reset successfully.'}
            </p>
    
            <div className="flex justify-end gap-3 mt-2">
              {data.newPassword && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(data.newPassword!);
                    toast.success('Copied!');
                  }}
                  className="text-sm bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 transition-all"
                >
                  Copy
                </button>
              )}
              <button
                onClick={() => toast.dismiss(t.id)}
                className="text-sm bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        ), {
          duration: Infinity, // won’t auto-close
          id, // replaces the loading toast
        });
    
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to reset password.', { id });
      }
    };
    

    const handleCancelResetPassword = () => {
        setShowPasswordDialog(false);
        setResetPasswordUserId(null);
        setCustomPassword('');
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
                <CardContent className="space-y-2">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                </CardContent>
            </Card>
        );
    }
    if (isError || !users) return <div className="p-4 text-red-500">Failed to load users.</div>;

    const sortedUsers = [...users].sort((a, b) => {
        if (a.status === UserStatus.PENDING && b.status !== UserStatus.PENDING) return -1;
        if (a.status !== UserStatus.PENDING && b.status === UserStatus.PENDING) return 1;
        return a.name.localeCompare(b.name);
    });

    return (
         <Card>
            <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Approve new registrations and manage user access.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg max-h-[70vh] overflow-y-auto">
                    {sortedUsers.map(user => (
                        <div key={user.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b last:border-b-0 gap-2">
                            <div>
                                <p className="font-semibold">{user.name} <span className="text-sm text-muted-foreground">({user.email})</span></p>
                                <p className={`mt-1 text-xs font-semibold inline-block px-2 py-0.5 rounded-full ${getUserStatusBadge(user.status)}`}>{user.status}</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                                {user.status === UserStatus.PENDING && (
                                    <Button size="sm" variant="outline" onClick={() => handleUpdateUserStatus(user.id, UserStatus.ACTIVE)} disabled={updateUserStatusMutation.isPending}>Approve</Button>
                                )}
                                {user.status === UserStatus.ACTIVE && (
                                    <>
                                        <Button size="sm" variant="destructive" onClick={() => handleUpdateUserStatus(user.id, UserStatus.INACTIVE)} disabled={updateUserStatusMutation.isPending}>Deactivate</Button>
                                        <Button size="sm" variant="outline" onClick={() => handleResetPassword(user.id)} disabled={resetPasswordMutation.isPending} title="Reset Password">
                                            <KeyIcon className="w-4 h-4" />
                                        </Button>
                                    </>
                                )}
                                 {user.status === UserStatus.INACTIVE && (
                                    <>
                                        <Button size="sm" variant="secondary" onClick={() => handleUpdateUserStatus(user.id, UserStatus.ACTIVE)} disabled={updateUserStatusMutation.isPending}>Re-activate</Button>
                                        <Button size="sm" variant="outline" onClick={() => handleResetPassword(user.id)} disabled={resetPasswordMutation.isPending} title="Reset Password">
                                            <KeyIcon className="w-4 h-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                
                {/* Password Reset Dialog */}
                {showPasswordDialog && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <Card className="w-full max-w-md mx-4">
                            <CardHeader>
                                <CardTitle>Reset Password</CardTitle>
                                <CardDescription>
                                    Reset password for user. Leave blank to generate a random password.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-password">New Password (optional)</Label>
                                    <Input
                                        id="new-password"
                                        type="text"
                                        placeholder="Leave blank for auto-generated password"
                                        value={customPassword}
                                        onChange={(e) => setCustomPassword(e.target.value)}
                                        minLength={6}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Minimum 6 characters. If left blank, a random 8-character password will be generated.
                                    </p>
                                </div>
                                <div className="flex gap-2 justify-end">
                                    <Button variant="outline" onClick={handleCancelResetPassword} disabled={resetPasswordMutation.isPending}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleConfirmResetPassword} disabled={resetPasswordMutation.isPending || (customPassword.trim().length > 0 && customPassword.trim().length < 6)}>
                                        {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


const AdminDashboard: React.FC<{ user: User, showToast: (message: string, type: 'success' | 'error' | 'info') => void }> = () => {
    const [activeTab, setActiveTab] = useState('management');
    
    const { data: allLeaves, isLoading: areLeavesLoading, isError: isLeavesError } = useAllLeaves();
    const { data: config, isLoading: isConfigLoading, isError: isConfigError } = useConfig();

    const updateStatusMutation = useUpdateLeaveStatusMutation();
    const updateMultipleStatusesMutation = useUpdateMultipleLeaveStatusesMutation();
    const updateConfigMutation = useUpdateConfigMutation();
    
    const handleStatusChange = (leaveId: string, status: LeaveStatus.APPROVED | LeaveStatus.REJECTED) => {
        toast.promise(
            updateStatusMutation.mutateAsync({ leaveId, status }),
            {
                loading: 'Updating status...',
                success: () => `Leave has been ${status.toLowerCase()}.`,
                error: (error: any) => error.response?.data?.message || 'Failed to update leave status.'
            }
        ).catch(() => {});
    };

    const handleBulkStatusChange = (variables: { leaveIds: string[], status: LeaveStatus.APPROVED | LeaveStatus.REJECTED }) => {
        toast.promise(
            updateMultipleStatusesMutation.mutateAsync(variables) as Promise<Leave[]>,
            {
                loading: 'Updating selected leaves...',
                success: (updatedData: Leave[]) => `${updatedData.length} leave(s) have been ${variables.status.toLowerCase()}.`,
                error: (error: any) => error.response?.data?.message || 'Failed to update leave statuses.'
            }
        ).catch(() => {});
    };

    const handleConfigSave = (newConfig: Config) => {
        toast.promise(
            updateConfigMutation.mutateAsync(newConfig),
            {
                loading: 'Saving settings...',
                success: 'Configuration saved successfully!',
                error: (error: any) => error.response?.data?.message || 'Failed to save configuration.'
            }
        ).catch(() => {});
    };


    if (areLeavesLoading || isConfigLoading) {
        return (
            <div className="container mx-auto p-4 md:p-8">
                <div className="grid grid-cols-5 gap-1 bg-muted p-1 rounded-md mb-2">
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                    <Skeleton className="h-8" />
                </div>
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/3 mb-2"/>
                        <Skeleton className="h-4 w-1/2"/>
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-64 w-full"/>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isLeavesError || isConfigError || !allLeaves || !config) {
        return <div className="flex justify-center items-center h-screen text-red-500">Failed to load admin data. Please try again later.</div>;
    }

    const isActionLoading = updateStatusMutation.isPending || updateConfigMutation.isPending || updateMultipleStatusesMutation.isPending;

    return (
        <div className="container mx-auto p-4 md:p-8">
            <Tabs className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger onClick={() => setActiveTab('analytics')} active={activeTab === 'analytics'}>
                        <BarChartIcon className="w-4 h-4 mr-2"/> Analytics
                    </TabsTrigger>
                    <TabsTrigger onClick={() => setActiveTab('management')} active={activeTab === 'management'}>
                        <ListIcon className="w-4 h-4 mr-2"/> Leaves
                    </TabsTrigger>
                    <TabsTrigger onClick={() => setActiveTab('users')} active={activeTab === 'users'}>
                        <UsersIcon className="w-4 h-4 mr-2"/> Users
                    </TabsTrigger>
                     <TabsTrigger onClick={() => setActiveTab('reports')} active={activeTab === 'reports'}>
                        <DownloadIcon className="w-4 h-4 mr-2"/> Reports
                    </TabsTrigger>
                    <TabsTrigger onClick={() => setActiveTab('settings')} active={activeTab === 'settings'}>
                        <SettingsIcon className="w-4 h-4 mr-2"/> Settings
                    </TabsTrigger>
                </TabsList>
                {activeTab === 'analytics' && (
                    <TabsContent>
                        <Analytics leaves={allLeaves} shifts={config.shifts} />
                    </TabsContent>
                )}
                {activeTab === 'management' && (
                    <TabsContent>
                        <LeaveManagement 
                            leaves={allLeaves} 
                            onStatusChange={handleStatusChange} 
                            onBulkStatusChange={handleBulkStatusChange}
                            isActionLoading={isActionLoading} 
                        />
                    </TabsContent>
                )}
                {activeTab === 'users' && (
                    <TabsContent>
                        <UserManagement />
                    </TabsContent>
                )}
                 {activeTab === 'reports' && (
                    <TabsContent>
                        <Reports leaves={allLeaves} />
                    </TabsContent>
                )}
                {activeTab === 'settings' && (
                    <TabsContent>
                        <Settings config={config} onSave={handleConfigSave} isLoading={isActionLoading}/>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
};

export default AdminDashboard;