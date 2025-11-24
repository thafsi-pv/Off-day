import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { User, Config, Leave, LeaveSlotInfo, Shift, LeaveStatus } from '../types';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Select } from './ui';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, CheckCircleIcon, AlertCircleIcon } from './icons';
import { useConfig } from '../hooks/useConfig';
import { useCreateLeaveMutation, useUserLeaves, useSlotInfoForDate, useSlotInfoForDateRange } from '../hooks/useLeaves';
import { formatDate, formatDateExtended } from '../utils/date';

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



const LeaveItem: React.FC<{ leave: Leave; isNextActive?: boolean }> = ({ leave, isNextActive }) => (
    <div className={`flex flex-col p-4 border-b border-border last:border-b-0 transition-colors ${isNextActive ? 'bg-blue-50 dark:bg-blue-900/50 border-l-4 border-blue-500 pl-3' : ''}`}>
        <div className="flex items-center justify-between w-full">
            <div>
                <p className="font-semibold">{formatDateExtended(leave.date)}</p>
                <p className="text-sm text-muted-foreground">{leave.shiftName}</p>
            </div>
            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusBadge(leave.status)}`}>
                {leave.status}
            </span>
        </div>
        {leave.status === LeaveStatus.REJECTED && leave.reason && (
            <div className="w-full mt-2 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                Reason: {leave.reason}
            </div>
        )}
    </div>
);

const getDayAriaLabel = (date: Date, isSelected: boolean, isDisabled: boolean, daySlotInfo: { availableSlots: number; totalSlots: number } | undefined, leaveStatus?: LeaveStatus): string => {
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' };
    const dateString = date.toLocaleDateString('en-US', options);

    let label = dateString;
    if (isSelected) {
        label = `Selected, ${label}`;
    }

    if (leaveStatus) {
        label += `, Leave status: ${leaveStatus}`;
    }

    if (isDisabled) {
        label += ", Not available";
    } else if (daySlotInfo) {
        label += `, ${daySlotInfo.availableSlots} of ${daySlotInfo.totalSlots} slots available`;
    } else {
        label += ", Slot information loading";
    }
    return label;
};


const CalendarView: React.FC<{
    config: Config;
    onDateSelect: (date: string) => void;
    selectedDate: string;
    slotInfo: { [date: string]: { availableSlots: number; totalSlots: number } };
    myLeaves: Leave[];
}> = ({ config, onDateSelect, selectedDate, slotInfo, myLeaves }) => {
    const [viewDate, setViewDate] = useState(() => {
        const now = new Date();
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    });

    const [focusedDate, setFocusedDate] = useState(() => {
        if (selectedDate) {
            const [year, month, day] = selectedDate.split('-').map(Number);
            return new Date(Date.UTC(year, month - 1, day));
        }
        const now = new Date();
        return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    });
    const gridRef = useRef<HTMLDivElement>(null);

    // const getStartOfWeekUTC = useCallback((date: Date): string => {
    //     const d = new Date(date.getTime());
    //     const day = d.getUTCDay(); // 0 = Sunday
    //     const diff = d.getUTCDate() - day;
    //     const startOfWeek = new Date(d.setUTCDate(diff));
    //     return startOfWeek.toISOString().split('T')[0];
    // }, []);
    const getStartOfWeekUTC = useCallback((date: Date): string => {
        const d = new Date(date.getTime());
        const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

        // Convert to Monday-start week index
        const mondayIndex = (day + 6) % 7; // Monday=0, Sunday=6

        const diff = d.getUTCDate() - mondayIndex;
        const startOfWeek = new Date(d.setUTCDate(diff));

        return startOfWeek.toISOString().split("T")[0];
    }, []);


    const bookedWeeks = useMemo(() => {
        const weekSet = new Set<string>();
        myLeaves.forEach(leave => {
            if (leave.status === LeaveStatus.PENDING || leave.status === LeaveStatus.APPROVED) {
                const [year, month, day] = leave.date.split('-').map(Number);
                const leaveDate = new Date(Date.UTC(year, month - 1, day));
                weekSet.add(getStartOfWeekUTC(leaveDate));
            }
        });
        return weekSet;
    }, [myLeaves, getStartOfWeekUTC]);

    const leavesByDate = useMemo(() => {
        const map = new Map<string, Leave>();
        myLeaves.forEach(leave => map.set(leave.date, leave));
        return map;
    }, [myLeaves]);


    useEffect(() => {
        if (selectedDate) {
            const [year, month, day] = selectedDate.split('-').map(Number);
            const newFocused = new Date(Date.UTC(year, month - 1, day));
            setFocusedDate(newFocused);
        }
    }, [selectedDate]);

    useEffect(() => {
        const dateString = focusedDate.toISOString().split('T')[0];
        const button = gridRef.current?.querySelector(`[data-date="${dateString}"]`) as HTMLButtonElement;
        if (button) {
            button.focus();
        }
    }, [focusedDate, viewDate]);

    const changeMonth = (offset: number) => {
        const newViewDate = new Date(viewDate.getTime());
        newViewDate.setUTCMonth(newViewDate.getUTCMonth() + offset, 1);
        setViewDate(newViewDate);

        // Set focused date to first day of new month
        const newFocusedDate = new Date(Date.UTC(newViewDate.getUTCFullYear(), newViewDate.getUTCMonth(), 1));
        setFocusedDate(newFocusedDate);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        let newFocusedDate = new Date(focusedDate.getTime());
        let preventDefault = true;

        switch (e.key) {
            case 'ArrowRight': newFocusedDate.setUTCDate(newFocusedDate.getUTCDate() + 1); break;
            case 'ArrowLeft': newFocusedDate.setUTCDate(newFocusedDate.getUTCDate() - 1); break;
            case 'ArrowUp': newFocusedDate.setUTCDate(newFocusedDate.getUTCDate() - 7); break;
            case 'ArrowDown': newFocusedDate.setUTCDate(newFocusedDate.getUTCDate() + 7); break;
            case 'PageUp':
                changeMonth(e.shiftKey ? -12 : -1);
                break;
            case 'PageDown':
                changeMonth(e.shiftKey ? 12 : 1);
                break;
            case 'Home': newFocusedDate.setUTCDate(newFocusedDate.getUTCDate() - newFocusedDate.getUTCDay()); break;
            case 'End': newFocusedDate.setUTCDate(newFocusedDate.getUTCDate() + (6 - newFocusedDate.getUTCDay())); break;
            case 'Enter':
            case ' ':
                const dateString = focusedDate.toISOString().split('T')[0];
                const button = gridRef.current?.querySelector(`[data-date="${dateString}"]`) as HTMLButtonElement;
                if (button && !button.disabled) {
                    onDateSelect(dateString);
                }
                break;
            default: preventDefault = false; break;
        }

        if (preventDefault) e.preventDefault();

        if (!['PageUp', 'PageDown', 'Enter', ' '].includes(e.key)) {
            if (newFocusedDate.getUTCMonth() !== viewDate.getUTCMonth() || newFocusedDate.getUTCFullYear() !== viewDate.getUTCFullYear()) {
                setViewDate(new Date(Date.UTC(newFocusedDate.getUTCFullYear(), newFocusedDate.getUTCMonth(), 1)));
            }
            setFocusedDate(newFocusedDate);
        }
    };

    const renderCalendar = () => {
        const year = viewDate.getUTCFullYear();
        const month = viewDate.getUTCMonth();
        const firstDayOfMonth = new Date(Date.UTC(year, month, 1)).getUTCDay();
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

        const now = new Date();
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

        const minDate = new Date(today.getTime());
        minDate.setDate(minDate.getDate() + 4);

        const maxDate = new Date(today.getTime());
        const dayOfWeek = today.getUTCDay();

        switch (config.weekRange) {
            case '1_WEEK':
                maxDate.setUTCDate(today.getUTCDate() + (6 - dayOfWeek));
                break;
            case '2_WEEKS':
                maxDate.setUTCDate(today.getUTCDate() + (6 - dayOfWeek) + 7);
                break;
            case '1_MONTH':
                maxDate.setUTCDate(today.getUTCDate() + 30);
                break;
        }


        const dayCells = [];
        for (let i = 0; i < firstDayOfMonth; i++) {
            dayCells.push(<div key={`empty-start-${i}`} role="gridcell" className="p-2"></div>);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(Date.UTC(year, month, day));
            const dateString = currentDate.toISOString().split('T')[0];
            const isSelected = selectedDate === dateString;
            const isFocused = focusedDate.getTime() === currentDate.getTime();

            const isPast = currentDate < minDate;
            const isFutureDisabled = currentDate > maxDate;
            const isDayDisabledByConfig = config.disabledDays.includes(currentDate.getUTCDay());
            const leaveOnDate = leavesByDate.get(dateString);
            const isWeekBooked = bookedWeeks.has(getStartOfWeekUTC(currentDate)) && (!leaveOnDate || (leaveOnDate.status !== LeaveStatus.APPROVED && leaveOnDate.status !== LeaveStatus.PENDING));

            const daySlotInfo = slotInfo[dateString];
            const hasSlots = daySlotInfo && daySlotInfo.availableSlots > 0;
            const isDisabled = isPast || isFutureDisabled || isDayDisabledByConfig || (daySlotInfo && !hasSlots) || isWeekBooked || (leaveOnDate && leaveOnDate.status !== LeaveStatus.REJECTED);

            const slotTextClass = !daySlotInfo ? 'text-gray-400' : hasSlots ? 'text-green-600' : 'text-red-600';

            let dayClass = '';
            if (leaveOnDate) {
                switch (leaveOnDate.status) {
                    case LeaveStatus.APPROVED: dayClass = 'bg-green-200 dark:bg-green-900/50 border-2 border-green-400'; break;
                    case LeaveStatus.PENDING: dayClass = 'bg-yellow-200 dark:bg-yellow-900/50 border-2 border-yellow-400'; break;
                    case LeaveStatus.REJECTED: dayClass = 'bg-red-200 dark:bg-red-900/50 line-through'; break;
                }
            }
            if (isSelected) {
                dayClass = 'bg-primary text-primary-foreground';
            } else if (!leaveOnDate) {
                dayClass = 'hover:bg-accent';
            }


            dayCells.push(
                <div role="gridcell" key={day}>
                    <button
                        onClick={() => onDateSelect(dateString)}
                        disabled={isDisabled}
                        tabIndex={isFocused ? 0 : -1}
                        data-date={dateString}
                        aria-selected={isSelected}
                        aria-disabled={isDisabled}
                        aria-label={getDayAriaLabel(currentDate, isSelected, isDisabled, daySlotInfo, leaveOnDate?.status)}
                        className={`w-full text-center p-2 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring ${dayClass} ${isPast || isFutureDisabled || isDayDisabledByConfig ? 'text-muted-foreground' : ''}`}
                    >
                        <div className="font-semibold" aria-hidden="true">{day}</div>
                        {!isDisabled && daySlotInfo && (
                            <div className={`text-xs ${slotTextClass}`} aria-hidden="true">
                                {daySlotInfo.availableSlots}/{daySlotInfo.totalSlots} slots
                            </div>
                        )}
                        {!isDisabled && !daySlotInfo && (
                            <div className="text-xs text-muted-foreground h-4" aria-hidden="true"></div>
                        )}
                    </button>
                </div>
            );
        }

        const rows = [];
        let i = 0;
        while (i < dayCells.length) {
            rows.push(
                <div key={`row-${i / 7}`} role="row" className="grid grid-cols-7 gap-1">
                    {dayCells.slice(i, i + 7)}
                </div>
            );
            i += 7;
        }
        return rows;
    };


    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeftIcon /></Button>
                <h3 id="calendar-heading" aria-live="polite" className="text-lg font-semibold">{viewDate.toLocaleString('default', { month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3>
                <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRightIcon /></Button>
            </div>
            <div role="grid" aria-labelledby="calendar-heading">
                <div role="row" className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
                    <div role="columnheader" aria-label="Sunday"><span aria-hidden="true">Sun</span></div>
                    <div role="columnheader" aria-label="Monday"><span aria-hidden="true">Mon</span></div>
                    <div role="columnheader" aria-label="Tuesday"><span aria-hidden="true">Tue</span></div>
                    <div role="columnheader" aria-label="Wednesday"><span aria-hidden="true">Wed</span></div>
                    <div role="columnheader" aria-label="Thursday"><span aria-hidden="true">Thu</span></div>
                    <div role="columnheader" aria-label="Friday"><span aria-hidden="true">Fri</span></div>
                    <div role="columnheader" aria-label="Saturday"><span aria-hidden="true">Sat</span></div>
                </div>
                <div className="mt-2 space-y-1" ref={gridRef} onKeyDown={handleKeyDown}>
                    {renderCalendar()}
                </div>
            </div>
        </div>
    );
};

const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse rounded-md bg-muted ${className}`} />
);

const UserDashboard: React.FC<{ user: User, showToast: (message: string, type: 'success' | 'error' | 'info') => void }> = ({ user, showToast }) => {
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedShift, setSelectedShift] = useState('');

    const { data: config, isLoading: isConfigLoading, isError: isConfigError } = useConfig();
    const { data: myLeaves, isLoading: areLeavesLoading, isError: isLeavesError } = useUserLeaves(user.id);

    const { dateRange } = useMemo(() => {
        if (!config) return { dateRange: null };
        const getMinDate = () => {
            const now = new Date();
            return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().split('T')[0];
        };
        const getMaxDate = (currentConfig: Config) => {
            const now = new Date();
            const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            const maxDate = new Date(today.getTime());
            const dayOfWeek = today.getUTCDay();
            switch (currentConfig.weekRange) {
                case '1_WEEK': maxDate.setUTCDate(today.getUTCDate() + (6 - dayOfWeek)); break;
                case '2_WEEKS': maxDate.setUTCDate(today.getUTCDate() + (6 - dayOfWeek) + 7); break;
                case '1_MONTH': maxDate.setUTCDate(today.getUTCDate() + 30); break;
            }
            return maxDate.toISOString().split('T')[0];
        };
        return { dateRange: { startDate: getMinDate(), endDate: getMaxDate(config) } };
    }, [config]);

    const { data: slotRangeInfo, isLoading: areSlotsLoading } = useSlotInfoForDateRange(dateRange, { enabled: !!dateRange });
    const { data: slotInfoForDate, isLoading: isSlotInfoForDateLoading } = useSlotInfoForDate(selectedDate, { enabled: !!selectedDate });

    const createLeaveMutation = useCreateLeaveMutation();

    const sortedLeaves = useMemo(() =>
        myLeaves ? [...myLeaves].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [],
        [myLeaves]);

    const nextActiveLeave = useMemo(() => {
        if (!sortedLeaves) return null;
        const now = new Date();
        now.setUTCHours(0, 0, 0, 0);

        const upcomingLeaves = sortedLeaves
            .filter(leave => {
                const leaveDate = new Date(leave.date + 'T00:00:00Z');
                return (leave.status === LeaveStatus.APPROVED || leave.status === LeaveStatus.PENDING) && leaveDate >= now;
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return upcomingLeaves.length > 0 ? upcomingLeaves[0] : null;
    }, [sortedLeaves]);


    const handleDateSelect = (date: string) => {
        setSelectedDate(date);
        setSelectedShift('');
    };

    const handleApplyLeave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDate || !selectedShift) {
            toast.error('Please select a date and a shift.');
            return;
        }

        const shiftSlots = slotInfoForDate?.find(s => s.shiftId === selectedShift);
        if (!shiftSlots || shiftSlots.availableSlots <= 0) {
            toast.error('No available slots for the selected shift.');
            return;
        }

        toast.promise(
            createLeaveMutation.mutateAsync({ userId: user.id, date: selectedDate, shiftId: selectedShift, creatorId: user.id }),
            {
                loading: 'Submitting request...',
                success: () => {
                    setSelectedDate('');
                    setSelectedShift('');
                    return 'Leave request submitted successfully!';
                },
                error: (error: any) => error.response?.data?.message || 'Failed to submit leave request.',
            }
        ).catch(() => { });
    };

    if (isConfigLoading || areLeavesLoading || areSlotsLoading) {
        return (
            <div className="container mx-auto p-4 md:p-8 grid gap-8 grid-cols-1 lg:grid-cols-3">
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader>
                        <CardContent className="space-y-4">
                            <Skeleton className="h-8 w-full" />
                            <div className="grid grid-cols-7 gap-2">
                                {Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                            </div>
                        </CardContent>
                    </Card>
                </div>
                <div className="lg:col-span-2 space-y-8">
                    <Card>
                        <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
                        <CardContent className="space-y-4">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-6 w-3/4" />
                            <Skeleton className="h-6 w-1/2" />
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader>
                        <CardContent className="p-0">
                            <div className="space-y-2 p-4">
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (isConfigError || isLeavesError || !config || !myLeaves || !slotRangeInfo) {
        return <div className="flex justify-center items-center h-screen text-red-500">Failed to load dashboard data. Please try again later.</div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8 grid gap-8 grid-cols-1 lg:grid-cols-3">
            <div className="lg:col-span-1">
                <Card>
                    <CardHeader>
                        <CardTitle>Apply for Leave</CardTitle>
                        <CardDescription>Select an available date to request a leave.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <CalendarView
                            config={config}
                            onDateSelect={handleDateSelect}
                            selectedDate={selectedDate}
                            slotInfo={slotRangeInfo}
                            myLeaves={myLeaves}
                        />
                        {selectedDate && (
                            <form onSubmit={handleApplyLeave} className="space-y-4 pt-4 border-t mt-4">
                                <h3 className="text-lg font-semibold">Selected Date: {formatDateExtended(selectedDate)}</h3>
                                <div className="space-y-2">
                                    <h4 className="text-sm font-medium">Available Slots</h4>
                                    {isSlotInfoForDateLoading && <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>}
                                    {slotInfoForDate && slotInfoForDate.length > 0 ? (
                                        config.shifts.map(shift => {
                                            const info = slotInfoForDate.find(s => s.shiftId === shift.id);
                                            const available = info ? info.availableSlots > 0 : false;
                                            return (
                                                <div key={shift.id} className={`text-sm p-2 rounded-md ${available ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                                                    {shift.name}: <span className="font-semibold">{info?.availableSlots ?? 0} / {info?.totalSlots ?? 0}</span> available
                                                </div>
                                            )
                                        })
                                    ) : !isSlotInfoForDateLoading && <p className="text-sm text-muted-foreground">Could not load slot details.</p>}
                                </div>
                                <div>
                                    <Label htmlFor="shift">Shift</Label>
                                    <Select
                                        id="shift"
                                        value={selectedShift}
                                        onChange={e => setSelectedShift(e.target.value)}
                                        required
                                        disabled={!slotInfoForDate || slotInfoForDate.every(s => s.availableSlots <= 0) || isSlotInfoForDateLoading}
                                    >
                                        <option value="">Select a shift</option>
                                        {config.shifts.map(shift => {
                                            const info = slotInfoForDate?.find(s => s.shiftId === shift.id);
                                            const disabled = !info || info.availableSlots <= 0;
                                            return (
                                                <option key={shift.id} value={shift.id} disabled={disabled}>
                                                    {shift.name} {disabled ? '(No slots)' : ''}
                                                </option>
                                            );
                                        })}
                                    </Select>
                                </div>
                                <Button type="submit" className="w-full" disabled={createLeaveMutation.isPending || !selectedShift}>
                                    {createLeaveMutation.isPending ? 'Submitting...' : 'Apply for Leave'}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
            <div className="lg:col-span-2 space-y-8">
                {nextActiveLeave && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Upcoming Leave</CardTitle>
                            <CardDescription>This is your next scheduled or requested leave.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {nextActiveLeave.status === LeaveStatus.PENDING && (
                                <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                                    <AlertCircleIcon className="h-5 w-5" />
                                    <p className="text-sm font-medium">You have a pending leave request.</p>
                                </div>
                            )}
                            {nextActiveLeave.status === LeaveStatus.APPROVED && (
                                <div className="flex items-center gap-3 rounded-lg border border-green-300 bg-green-50 p-4 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300">
                                    <CheckCircleIcon className="h-5 w-5" />
                                    <p className="text-sm font-medium">
                                        {nextActiveLeave.creatorId && nextActiveLeave.creatorId !== user.id
                                            ? "Your next assigned leave is confirmed."
                                            : "Your leave request is approved!"}
                                    </p>
                                </div>
                            )}
                            <div>
                                <p className="text-sm text-muted-foreground">Date</p>
                                <p className="font-semibold">{formatDateExtended(nextActiveLeave.date)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Shift</p>
                                <p className="font-semibold">{nextActiveLeave.shiftName}</p>
                            </div>
                        </CardContent>
                    </Card>
                )}
                <Card>
                    <CardHeader>
                        <CardTitle>My Leave History</CardTitle>
                        <CardDescription>A list of your past and pending leave requests.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        {sortedLeaves.length > 0 ? (
                            <div className="max-h-[60vh] overflow-y-auto">
                                {sortedLeaves.map(leave => <LeaveItem key={leave.id} leave={leave} isNextActive={leave.id === nextActiveLeave?.id} />)}
                            </div>
                        ) : (
                            <div className="p-6 text-center text-muted-foreground">
                                <CalendarIcon className="mx-auto h-12 w-12" />
                                <p className="mt-4">You have not applied for any leaves yet.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default UserDashboard;






// import React, {
//   useState,
//   useEffect,
//   useCallback,
//   useRef,
//   useMemo,
// } from "react";
// import { toast } from "react-hot-toast";
// import {
//   User,
//   Config,
//   Leave,
//   LeaveSlotInfo,
//   Shift,
//   LeaveStatus,
// } from "../types";
// import {
//   Button,
//   Card,
//   CardContent,
//   CardDescription,
//   CardHeader,
//   CardTitle,
//   Label,
//   Select,
// } from "./ui";
// import {
//   CalendarIcon,
//   ChevronLeftIcon,
//   ChevronRightIcon,
//   CheckCircleIcon,
//   AlertCircleIcon,
// } from "./icons";
// import { useConfig } from "../hooks/useConfig";
// import {
//   useCreateLeaveMutation,
//   useUserLeaves,
//   useSlotInfoForDate,
//   useSlotInfoForDateRange,
// } from "../hooks/useLeaves";

// const getStatusBadge = (status: LeaveStatus) => {
//   switch (status) {
//     case LeaveStatus.APPROVED:
//       return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
//     case LeaveStatus.REJECTED:
//       return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
//     case LeaveStatus.PENDING:
//     default:
//       return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
//   }
// };

// const formatDate = (dateString: string) => {
//   const [year, month, day] = dateString.split("-").map(Number);
//   const date = new Date(Date.UTC(year, month - 1, day));
//   return date.toLocaleDateString("en-US", {
//     year: "numeric",
//     month: "long",
//     day: "numeric",
//     timeZone: "UTC",
//   });
// };

// const LeaveItem: React.FC<{ leave: Leave; isNextActive?: boolean }> = ({
//   leave,
//   isNextActive,
// }) => (
//   <div
//     className={`flex items-center justify-between p-4 border-b border-border last:border-b-0 transition-colors ${
//       isNextActive
//         ? "bg-blue-50 dark:bg-blue-900/50 border-l-4 border-blue-500 pl-3"
//         : ""
//     }`}>
//     <div>
//       <p className="font-semibold">{formatDate(leave.date)}</p>
//       <p className="text-sm text-muted-foreground">{leave.shiftName}</p>
//     </div>
//     <span
//       className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusBadge(
//         leave.status
//       )}`}>
//       {leave.status}
//     </span>
//   </div>
// );

// const getDayAriaLabel = (
//   date: Date,
//   isSelected: boolean,
//   isDisabled: boolean,
//   daySlotInfo: { availableSlots: number; totalSlots: number } | undefined,
//   leaveStatus?: LeaveStatus
// ): string => {
//   const options: Intl.DateTimeFormatOptions = {
//     weekday: "long",
//     year: "numeric",
//     month: "long",
//     day: "numeric",
//     timeZone: "UTC",
//   };
//   const dateString = date.toLocaleDateString("en-US", options);

//   let label = dateString;
//   if (isSelected) {
//     label = `Selected, ${label}`;
//   }

//   if (leaveStatus) {
//     label += `, Leave status: ${leaveStatus}`;
//   }

//   if (isDisabled) {
//     label += ", Not available";
//   } else if (daySlotInfo) {
//     label += `, ${daySlotInfo.availableSlots} of ${daySlotInfo.totalSlots} slots available`;
//   } else {
//     label += ", Slot information loading";
//   }
//   return label;
// };

// const CalendarView: React.FC<{
//   config: Config;
//   onDateSelect: (date: string) => void;
//   selectedDate: string;
//   slotInfo: { [date: string]: { availableSlots: number; totalSlots: number } };
//   myLeaves: Leave[];
// }> = ({ config, onDateSelect, selectedDate, slotInfo, myLeaves }) => {
//   const [viewDate, setViewDate] = useState(() => {
//     const now = new Date();
//     return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
//   });

//   const [focusedDate, setFocusedDate] = useState(() => {
//     if (selectedDate) {
//       const [year, month, day] = selectedDate.split("-").map(Number);
//       return new Date(Date.UTC(year, month - 1, day));
//     }
//     const now = new Date();
//     return new Date(
//       Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
//     );
//   });
//   const gridRef = useRef<HTMLDivElement>(null);

//   const getStartOfWeekUTC = useCallback((date: Date): string => {
//     const d = new Date(date.getTime());
//     const day = d.getUTCDay(); // 0 = Sunday
//     const diff = d.getUTCDate() - day;
//     const startOfWeek = new Date(d.setUTCDate(diff));
//     return startOfWeek.toISOString().split("T")[0];
//   }, []);

//   const bookedWeeks = useMemo(() => {
//     const weekSet = new Set<string>();
//     myLeaves.forEach((leave) => {
//       if (
//         leave.status === LeaveStatus.PENDING ||
//         leave.status === LeaveStatus.APPROVED
//       ) {
//         const [year, month, day] = leave.date.split("-").map(Number);
//         const leaveDate = new Date(Date.UTC(year, month - 1, day));
//         weekSet.add(getStartOfWeekUTC(leaveDate));
//       }
//     });
//     return weekSet;
//   }, [myLeaves, getStartOfWeekUTC]);

//   const leavesByDate = useMemo(() => {
//     const map = new Map<string, Leave>();
//     myLeaves.forEach((leave) => map.set(leave.date, leave));
//     return map;
//   }, [myLeaves]);

//   useEffect(() => {
//     if (selectedDate) {
//       const [year, month, day] = selectedDate.split("-").map(Number);
//       const newFocused = new Date(Date.UTC(year, month - 1, day));
//       setFocusedDate(newFocused);
//       if (
//         newFocused.getUTCMonth() !== viewDate.getUTCMonth() ||
//         newFocused.getUTCFullYear() !== viewDate.getUTCFullYear()
//       ) {
//         setViewDate(
//           new Date(
//             Date.UTC(newFocused.getUTCFullYear(), newFocused.getUTCMonth(), 1)
//           )
//         );
//       }
//     }
//   }, [selectedDate, viewDate]);

//   useEffect(() => {
//     const dateString = focusedDate.toISOString().split("T")[0];
//     const button = gridRef.current?.querySelector(
//       `[data-date="${dateString}"]`
//     ) as HTMLButtonElement;
//     if (button) {
//       button.focus();
//     }
//   }, [focusedDate, viewDate]);

//   const changeMonth = (offset: number) => {
//     const newViewDate = new Date(viewDate.getTime());
//     newViewDate.setUTCMonth(newViewDate.getUTCMonth() + offset, 1);
//     setViewDate(newViewDate);
//     setFocusedDate(newViewDate);
//   };

//   const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
//     let newFocusedDate = new Date(focusedDate.getTime());
//     let preventDefault = true;

//     switch (e.key) {
//       case "ArrowRight":
//         newFocusedDate.setUTCDate(newFocusedDate.getUTCDate() + 1);
//         break;
//       case "ArrowLeft":
//         newFocusedDate.setUTCDate(newFocusedDate.getUTCDate() - 1);
//         break;
//       case "ArrowUp":
//         newFocusedDate.setUTCDate(newFocusedDate.getUTCDate() - 7);
//         break;
//       case "ArrowDown":
//         newFocusedDate.setUTCDate(newFocusedDate.getUTCDate() + 7);
//         break;
//       case "PageUp":
//         changeMonth(e.shiftKey ? -12 : -1);
//         break;
//       case "PageDown":
//         changeMonth(e.shiftKey ? 12 : 1);
//         break;
//       case "Home":
//         newFocusedDate.setUTCDate(
//           newFocusedDate.getUTCDate() - newFocusedDate.getUTCDay()
//         );
//         break;
//       case "End":
//         newFocusedDate.setUTCDate(
//           newFocusedDate.getUTCDate() + (6 - newFocusedDate.getUTCDay())
//         );
//         break;
//       case "Enter":
//       case " ":
//         const dateString = focusedDate.toISOString().split("T")[0];
//         const button = gridRef.current?.querySelector(
//           `[data-date="${dateString}"]`
//         ) as HTMLButtonElement;
//         if (button && !button.disabled) {
//           onDateSelect(dateString);
//         }
//         break;
//       default:
//         preventDefault = false;
//         break;
//     }

//     if (preventDefault) e.preventDefault();

//     if (!["PageUp", "PageDown", "Enter", " "].includes(e.key)) {
//       if (
//         newFocusedDate.getUTCMonth() !== viewDate.getUTCMonth() ||
//         newFocusedDate.getUTCFullYear() !== viewDate.getUTCFullYear()
//       ) {
//         setViewDate(
//           new Date(
//             Date.UTC(
//               newFocusedDate.getUTCFullYear(),
//               newFocusedDate.getUTCMonth(),
//               1
//             )
//           )
//         );
//       }
//       setFocusedDate(newFocusedDate);
//     }
//   };

//   const renderCalendar = () => {
//     const year = viewDate.getUTCFullYear();
//     const month = viewDate.getUTCMonth();
//     const firstDayOfMonth = new Date(Date.UTC(year, month, 1)).getUTCDay();
//     const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

//     const now = new Date();
//     const today = new Date(
//       Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
//     );

//     const minDate = new Date(today.setDate(today.getDate() + 4));

//     const maxDate = new Date(today);
//     const dayOfWeek = today.getUTCDay();

//     switch (config.weekRange) {
//       case "1_WEEK":
//         maxDate.setUTCDate(today.getUTCDate() + (6 - dayOfWeek));
//         break;
//       case "2_WEEKS":
//         maxDate.setUTCDate(today.getUTCDate() + (6 - dayOfWeek) + 7);
//         break;
//       case '1_MONTH':
//           maxDate.setUTCFullYear(today.getUTCFullYear(), today.getUTCMonth() + 1, 0);
//           break;
//     //   case "1_MONTH":
//     //     maxDate.setUTCDate(today.getUTCDate() + 30);
//     //     break;
//     }

//     const dayCells = [];
//     for (let i = 0; i < firstDayOfMonth; i++) {
//       dayCells.push(
//         <div key={`empty-start-${i}`} role="gridcell" className="p-2"></div>
//       );
//     }

//     for (let day = 1; day <= daysInMonth; day++) {
//       const currentDate = new Date(Date.UTC(year, month, day));
//       const dateString = currentDate.toISOString().split("T")[0];
//       const isSelected = selectedDate === dateString;
//       const isFocused = focusedDate.getTime() === currentDate.getTime();

//       const isPast = currentDate < minDate;
//       const isFutureDisabled = currentDate > maxDate;
//       const isDayDisabledByConfig = config.disabledDays.includes(
//         currentDate.getUTCDay()
//       );
//       const leaveOnDate = leavesByDate.get(dateString);
//       const isWeekBooked =
//         bookedWeeks.has(getStartOfWeekUTC(currentDate)) &&
//         (!leaveOnDate ||
//           (leaveOnDate.status !== LeaveStatus.APPROVED &&
//             leaveOnDate.status !== LeaveStatus.PENDING));

//       const daySlotInfo = slotInfo[dateString];
//       const hasSlots = daySlotInfo && daySlotInfo.availableSlots > 0;
//       const isDisabled =
//         isPast ||
//         isFutureDisabled ||
//         isDayDisabledByConfig ||
//         (daySlotInfo && !hasSlots) ||
//         isWeekBooked ||
//         (leaveOnDate && leaveOnDate.status !== LeaveStatus.REJECTED);

//       const slotTextClass = !daySlotInfo
//         ? "text-gray-400"
//         : hasSlots
//         ? "text-green-600"
//         : "text-red-600";

//       let dayClass = "";
//       if (leaveOnDate) {
//         switch (leaveOnDate.status) {
//           case LeaveStatus.APPROVED:
//             dayClass =
//               "bg-green-200 dark:bg-green-900/50 border-2 border-green-400";
//             break;
//           case LeaveStatus.PENDING:
//             dayClass =
//               "bg-yellow-200 dark:bg-yellow-900/50 border-2 border-yellow-400";
//             break;
//           case LeaveStatus.REJECTED:
//             dayClass = "bg-red-200 dark:bg-red-900/50 line-through";
//             break;
//         }
//       }
//       if (isSelected) {
//         dayClass = "bg-primary text-primary-foreground";
//       } else if (!leaveOnDate) {
//         dayClass = "hover:bg-accent";
//       }

//       dayCells.push(
//         <div role="gridcell" key={day}>
//           <button
//             onClick={() => onDateSelect(dateString)}
//             disabled={isDisabled}
//             tabIndex={isFocused ? 0 : -1}
//             data-date={dateString}
//             aria-selected={isSelected}
//             aria-disabled={isDisabled}
//             aria-label={getDayAriaLabel(
//               currentDate,
//               isSelected,
//               isDisabled,
//               daySlotInfo,
//               leaveOnDate?.status
//             )}
//             className={`w-full text-center p-2 rounded-lg transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-ring ${dayClass} ${
//               isPast || isFutureDisabled || isDayDisabledByConfig
//                 ? "text-muted-foreground"
//                 : ""
//             }`}>
//             <div className="font-semibold" aria-hidden="true">
//               {day}
//             </div>
//             {!isDisabled && daySlotInfo && (
//               <div className={`text-xs ${slotTextClass}`} aria-hidden="true">
//                 {daySlotInfo.availableSlots}/{daySlotInfo.totalSlots} slots
//               </div>
//             )}
//             {!isDisabled && !daySlotInfo && (
//               <div
//                 className="text-xs text-muted-foreground h-4"
//                 aria-hidden="true"></div>
//             )}
//           </button>
//         </div>
//       );
//     }

//     const rows = [];
//     let i = 0;
//     while (i < dayCells.length) {
//       rows.push(
//         <div key={`row-${i / 7}`} role="row" className="grid grid-cols-7 gap-1">
//           {dayCells.slice(i, i + 7)}
//         </div>
//       );
//       i += 7;
//     }
//     return rows;
//   };

//   return (
//     <div className="space-y-4">
//       <div className="flex justify-between items-center">
//         <Button
//           variant="ghost"
//           size="icon"
//           onClick={() => changeMonth(-1)}
//           aria-label="Previous month">
//           <ChevronLeftIcon />
//         </Button>
//         <h3
//           id="calendar-heading"
//           aria-live="polite"
//           className="text-lg font-semibold">
//           {viewDate.toLocaleString("default", {
//             month: "long",
//             year: "numeric",
//             timeZone: "UTC",
//           })}
//         </h3>
//         <Button
//           variant="ghost"
//           size="icon"
//           onClick={() => changeMonth(1)}
//           aria-label="Next month">
//           <ChevronRightIcon />
//         </Button>
//       </div>
//       <div role="grid" aria-labelledby="calendar-heading">
//         <div
//           role="row"
//           className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
//           <div role="columnheader" aria-label="Sunday">
//             <span aria-hidden="true">Sun</span>
//           </div>
//           <div role="columnheader" aria-label="Monday">
//             <span aria-hidden="true">Mon</span>
//           </div>
//           <div role="columnheader" aria-label="Tuesday">
//             <span aria-hidden="true">Tue</span>
//           </div>
//           <div role="columnheader" aria-label="Wednesday">
//             <span aria-hidden="true">Wed</span>
//           </div>
//           <div role="columnheader" aria-label="Thursday">
//             <span aria-hidden="true">Thu</span>
//           </div>
//           <div role="columnheader" aria-label="Friday">
//             <span aria-hidden="true">Fri</span>
//           </div>
//           <div role="columnheader" aria-label="Saturday">
//             <span aria-hidden="true">Sat</span>
//           </div>
//         </div>
//         <div className="mt-2 space-y-1" ref={gridRef} onKeyDown={handleKeyDown}>
//           {renderCalendar()}
//         </div>
//       </div>
//     </div>
//   );
// };

// const Skeleton = ({ className }: { className?: string }) => (
//   <div className={`animate-pulse rounded-md bg-muted ${className}`} />
// );

// const UserDashboard: React.FC<{
//   user: User;
//   showToast: (message: string, type: "success" | "error" | "info") => void;
// }> = ({ user, showToast }) => {
//   const [selectedDate, setSelectedDate] = useState("");
//   const [selectedShift, setSelectedShift] = useState("");

//   const {
//     data: config,
//     isLoading: isConfigLoading,
//     isError: isConfigError,
//   } = useConfig();
//   const {
//     data: myLeaves,
//     isLoading: areLeavesLoading,
//     isError: isLeavesError,
//   } = useUserLeaves(user.id);

//   const { dateRange } = useMemo(() => {
//     if (!config) return { dateRange: null };
//     const getMinDate = () => {
//       const now = new Date();
//       return new Date(
//         Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
//       )
//         .toISOString()
//         .split("T")[0];
//     };
//     const getMaxDate = (currentConfig: Config) => {
//       const now = new Date();
//       const today = new Date(
//         Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
//       );
//       const maxDate = new Date(today);
//       const dayOfWeek = today.getUTCDay();
//       switch (currentConfig.weekRange) {
//         case "1_WEEK":
//           maxDate.setUTCDate(today.getUTCDate() + (6 - dayOfWeek));
//           break;
//         case "2_WEEKS":
//           maxDate.setUTCDate(today.getUTCDate() + (6 - dayOfWeek) + 7);
//           break;
//         case "1_MONTH":
//           maxDate.setUTCFullYear(
//             today.getUTCFullYear(),
//             today.getUTCMonth() + 1,
//             0
//           );
//           break;
//       }
//       return maxDate.toISOString().split("T")[0];
//     };
//     return {
//       dateRange: { startDate: getMinDate(), endDate: getMaxDate(config) },
//     };
//   }, [config]);

//   const { data: slotRangeInfo, isLoading: areSlotsLoading } =
//     useSlotInfoForDateRange(dateRange, { enabled: !!dateRange });
//   const { data: slotInfoForDate, isLoading: isSlotInfoForDateLoading } =
//     useSlotInfoForDate(selectedDate, { enabled: !!selectedDate });

//   const createLeaveMutation = useCreateLeaveMutation();

//   const sortedLeaves = useMemo(
//     () =>
//       myLeaves
//         ? [...myLeaves].sort(
//             (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
//           )
//         : [],
//     [myLeaves]
//   );

//   const nextActiveLeave = useMemo(() => {
//     if (!sortedLeaves) return null;
//     const now = new Date();
//     now.setUTCHours(0, 0, 0, 0);

//     const upcomingLeaves = sortedLeaves
//       .filter((leave) => {
//         const leaveDate = new Date(leave.date + "T00:00:00Z");
//         return (
//           (leave.status === LeaveStatus.APPROVED ||
//             leave.status === LeaveStatus.PENDING) &&
//           leaveDate >= now
//         );
//       })
//       .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

//     return upcomingLeaves.length > 0 ? upcomingLeaves[0] : null;
//   }, [sortedLeaves]);

//   const handleDateSelect = (date: string) => {
//     setSelectedDate(date);
//     setSelectedShift("");
//   };

//   const handleApplyLeave = async (e: React.FormEvent) => {
//     e.preventDefault();
//     if (!selectedDate || !selectedShift) {
//       toast.error("Please select a date and a shift.");
//       return;
//     }

//     const shiftSlots = slotInfoForDate?.find(
//       (s) => s.shiftId === selectedShift
//     );
//     if (!shiftSlots || shiftSlots.availableSlots <= 0) {
//       toast.error("No available slots for the selected shift.");
//       return;
//     }

//     toast
//       .promise(
//         createLeaveMutation.mutateAsync({
//           userId: user.id,
//           date: selectedDate,
//           shiftId: selectedShift,
//         }),
//         {
//           loading: "Submitting request...",
//           success: () => {
//             setSelectedDate("");
//             setSelectedShift("");
//             return "Leave request submitted successfully!";
//           },
//           error: (error: any) =>
//             error.response?.data?.message || "Failed to submit leave request.",
//         }
//       )
//       .catch(() => {});
//   };

//   if (isConfigLoading || areLeavesLoading || areSlotsLoading) {
//     return (
//       <div className="container mx-auto p-4 md:p-8 grid gap-8 grid-cols-1 lg:grid-cols-3">
//         <div className="lg:col-span-1">
//           <Card>
//             <CardHeader>
//               <Skeleton className="h-8 w-3/4" />
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <Skeleton className="h-8 w-full" />
//               <div className="grid grid-cols-7 gap-2">
//                 {Array.from({ length: 35 }).map((_, i) => (
//                   <Skeleton key={i} className="h-16 w-full" />
//                 ))}
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//         <div className="lg:col-span-2 space-y-8">
//           <Card>
//             <CardHeader>
//               <Skeleton className="h-8 w-1/2" />
//             </CardHeader>
//             <CardContent className="space-y-4">
//               <Skeleton className="h-10 w-full" />
//               <Skeleton className="h-6 w-3/4" />
//               <Skeleton className="h-6 w-1/2" />
//             </CardContent>
//           </Card>
//           <Card>
//             <CardHeader>
//               <Skeleton className="h-8 w-1/2" />
//             </CardHeader>
//             <CardContent className="p-0">
//               <div className="space-y-2 p-4">
//                 <Skeleton className="h-12 w-full" />
//                 <Skeleton className="h-12 w-full" />
//                 <Skeleton className="h-12 w-full" />
//               </div>
//             </CardContent>
//           </Card>
//         </div>
//       </div>
//     );
//   }

//   if (
//     isConfigError ||
//     isLeavesError ||
//     !config ||
//     !myLeaves ||
//     !slotRangeInfo
//   ) {
//     return (
//       <div className="flex justify-center items-center h-screen text-red-500">
//         Failed to load dashboard data. Please try again later.
//       </div>
//     );
//   }

//   return (
//     <div className="container mx-auto p-4 md:p-8 grid gap-8 grid-cols-1 lg:grid-cols-3">
//       <div className="lg:col-span-1">
//         <Card>
//           <CardHeader>
//             <CardTitle>Apply for Leave</CardTitle>
//             <CardDescription>
//               Select an available date to request a leave.
//             </CardDescription>
//           </CardHeader>
//           <CardContent>
//             <CalendarView
//               config={config}
//               onDateSelect={handleDateSelect}
//               selectedDate={selectedDate}
//               slotInfo={slotRangeInfo}
//               myLeaves={myLeaves}
//             />
//             {selectedDate && (
//               <form
//                 onSubmit={handleApplyLeave}
//                 className="space-y-4 pt-4 border-t mt-4">
//                 <h3 className="text-lg font-semibold">
//                   Selected Date: {formatDate(selectedDate)}
//                 </h3>
//                 <div className="space-y-2">
//                   <h4 className="text-sm font-medium">Available Slots</h4>
//                   {isSlotInfoForDateLoading && (
//                     <div className="space-y-2">
//                       <Skeleton className="h-8 w-full" />
//                       <Skeleton className="h-8 w-full" />
//                     </div>
//                   )}
//                   {slotInfoForDate && slotInfoForDate.length > 0
//                     ? config.shifts.map((shift) => {
//                         const info = slotInfoForDate.find(
//                           (s) => s.shiftId === shift.id
//                         );
//                         const available = info
//                           ? info.availableSlots > 0
//                           : false;
//                         return (
//                           <div
//                             key={shift.id}
//                             className={`text-sm p-2 rounded-md ${
//                               available
//                                 ? "bg-green-100 dark:bg-green-900"
//                                 : "bg-red-100 dark:bg-red-900"
//                             }`}>
//                             {shift.name}:{" "}
//                             <span className="font-semibold">
//                               {info?.availableSlots ?? 0} /{" "}
//                               {info?.totalSlots ?? 0}
//                             </span>{" "}
//                             available
//                           </div>
//                         );
//                       })
//                     : !isSlotInfoForDateLoading && (
//                         <p className="text-sm text-muted-foreground">
//                           Could not load slot details.
//                         </p>
//                       )}
//                 </div>
//                 <div>
//                   <Label htmlFor="shift">Shift</Label>
//                   <Select
//                     id="shift"
//                     value={selectedShift}
//                     onChange={(e) => setSelectedShift(e.target.value)}
//                     required
//                     disabled={
//                       !slotInfoForDate ||
//                       slotInfoForDate.every((s) => s.availableSlots <= 0) ||
//                       isSlotInfoForDateLoading
//                     }>
//                     <option value="">Select a shift</option>
//                     {config.shifts.map((shift) => {
//                       const info = slotInfoForDate?.find(
//                         (s) => s.shiftId === shift.id
//                       );
//                       const disabled = !info || info.availableSlots <= 0;
//                       return (
//                         <option
//                           key={shift.id}
//                           value={shift.id}
//                           disabled={disabled}>
//                           {shift.name} {disabled ? "(No slots)" : ""}
//                         </option>
//                       );
//                     })}
//                   </Select>
//                 </div>
//                 <Button
//                   type="submit"
//                   className="w-full"
//                   disabled={createLeaveMutation.isPending || !selectedShift}>
//                   {createLeaveMutation.isPending
//                     ? "Submitting..."
//                     : "Apply for Leave"}
//                 </Button>
//               </form>
//             )}
//           </CardContent>
//         </Card>
//       </div>
//       <div className="lg:col-span-2 space-y-8">
//         {nextActiveLeave && (
//           <Card>
//             <CardHeader>
//               <CardTitle>Upcoming Leave</CardTitle>
//               <CardDescription>
//                 This is your next scheduled or requested leave.
//               </CardDescription>
//             </CardHeader>
//             <CardContent className="space-y-4">
//               {nextActiveLeave.status === LeaveStatus.PENDING && (
//                 <div className="flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-yellow-800 dark:border-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
//                   <AlertCircleIcon className="h-5 w-5" />
//                   <p className="text-sm font-medium">
//                     You have a pending leave request.
//                   </p>
//                 </div>
//               )}
//               {nextActiveLeave.status === LeaveStatus.APPROVED && (
//                 <div className="flex items-center gap-3 rounded-lg border border-green-300 bg-green-50 p-4 text-green-800 dark:border-green-700 dark:bg-green-900/30 dark:text-green-300">
//                   <CheckCircleIcon className="h-5 w-5" />
//                   <p className="text-sm font-medium">
//                     Your leave request is approved!
//                   </p>
//                 </div>
//               )}
//               <div>
//                 <p className="text-sm text-muted-foreground">Date</p>
//                 <p className="font-semibold">
//                   {formatDate(nextActiveLeave.date)}
//                 </p>
//               </div>
//               <div>
//                 <p className="text-sm text-muted-foreground">Shift</p>
//                 <p className="font-semibold">{nextActiveLeave.shiftName}</p>
//               </div>
//             </CardContent>
//           </Card>
//         )}
//         <Card>
//           <CardHeader>
//             <CardTitle>My Leave History</CardTitle>
//             <CardDescription>
//               A list of your past and pending leave requests.
//             </CardDescription>
//           </CardHeader>
//           <CardContent className="p-0">
//             {sortedLeaves.length > 0 ? (
//               <div className="max-h-[60vh] overflow-y-auto">
//                 {sortedLeaves.map((leave) => (
//                   <LeaveItem
//                     key={leave.id}
//                     leave={leave}
//                     isNextActive={leave.id === nextActiveLeave?.id}
//                   />
//                 ))}
//               </div>
//             ) : (
//               <div className="p-6 text-center text-muted-foreground">
//                 <CalendarIcon className="mx-auto h-12 w-12" />
//                 <p className="mt-4">You have not applied for any leaves yet.</p>
//               </div>
//             )}
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   );
// };

// export default UserDashboard;
