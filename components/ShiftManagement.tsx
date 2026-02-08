import React, { useState, useMemo } from "react";
import { format, startOfWeek, addDays, addWeeks, subWeeks } from "date-fns";
import { FaCheck, FaSort, FaTimes, FaCopy } from "react-icons/fa";
import { cn } from "./ui";
import {
    Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Badge, Select,
    Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
    Popover, PopoverContent, PopoverTrigger,
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "./ui";
import { User, Shift } from "../types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getShiftsForWeek, removeUserShift, copyPreviousWeek, updateUserShift, swapUserShifts } from "../services/api";
import { toast } from "react-hot-toast";

interface ShiftManagementProps {
    users: User[];
    shifts: Shift[];
}

export const ShiftManagement: React.FC<ShiftManagementProps> = ({ users, shifts }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [showCopyDialog, setShowCopyDialog] = useState(false);

    const queryClient = useQueryClient();

    // Ensure Monday start
    const weekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);
    const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

    const { data: weekShifts = [] } = useQuery({
        queryKey: ["week-shifts", format(weekStart, "yyyy-MM-dd")],
        queryFn: () => getShiftsForWeek(format(weekStart, "yyyy-MM-dd")),
    });

    const copyPreviousWeekMutation = useMutation({
        mutationFn: copyPreviousWeek,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["week-shifts"] });
            toast.success(data.message || "Previous week copied successfully");
            setShowCopyDialog(false);
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to copy previous week");
        },
    });

    const updateShiftMutation = useMutation({
        mutationFn: updateUserShift,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["week-shifts"] });
            // Don't show toast here - will be handled by caller for bulk operations
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to update shift");
        },
    });

    const swapShiftMutation = useMutation({
        mutationFn: swapUserShifts,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["week-shifts"] });
            toast.success(data.message || "Shifts swapped successfully");
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to swap shifts");
        },
    });

    const removeUserMutation = useMutation({
        mutationFn: ({ userId, date }: { userId: string; date: string }) =>
            removeUserShift(userId, date),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["week-shifts"] });
            toast.success("User removed successfully");
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || "Failed to remove user");
        },
    });

    // Create a map of userId to their shift for this week
    const userShiftMap = useMemo(() => {
        const map = new Map<string, { shiftId: string; shift: Shift }>();
        weekShifts.forEach((ws: any) => {
            map.set(ws.userId, { shiftId: ws.shiftId, shift: ws.shift });
        });
        return map;
    }, [weekShifts]);

    // Group users by shift
    const shiftAssignments = useMemo(() => {
        const assignments: { [shiftId: string]: User[] } = {};

        shifts.forEach(shift => {
            assignments[shift.id] = weekShifts
                .filter((ws: any) => ws.shiftId === shift.id)
                .map((ws: any) => ws.user);
        });

        return assignments;
    }, [weekShifts, shifts]);

    // Get assigned user IDs
    const assignedUserIds = useMemo(() => {
        return new Set(weekShifts.map((ws: any) => ws.userId));
    }, [weekShifts]);

    // Get available users (not assigned to any shift this week)
    const availableUsers = useMemo(() => {
        return users.filter((user) => !assignedUserIds.has(user.id));
    }, [users, assignedUserIds]);

    const handleCopyPreviousWeek = () => {
        copyPreviousWeekMutation.mutate(format(weekStart, "yyyy-MM-dd"));
    };

    const handleRemoveUser = (userId: string) => {
        removeUserMutation.mutate({
            userId,
            date: format(weekStart, "yyyy-MM-dd"),
        });
    };

    const handleAddUsersToShift = async (shiftId: string, userIds: string[]) => {
        // Add multiple users to a shift with a single toast
        try {
            await Promise.all(userIds.map(userId =>
                updateShiftMutation.mutateAsync({
                    userId,
                    shiftId,
                    startDate: format(weekStart, "yyyy-MM-dd"),
                })
            ));
            toast.success(`${userIds.length} user(s) added successfully`);
        } catch (error) {
            // Error toast is already handled by mutation
        }
    };

    const handleChangeUserShift = (userId: string, newShiftId: string, skipConfirm = false) => {
        if (!newShiftId) return;

        const currentUserShift = userShiftMap.get(userId);
        const currentShiftId = currentUserShift?.shiftId;

        // If user is selecting the same shift, do nothing
        if (currentShiftId === newShiftId) {
            return;
        }

        // Find if another user has this shift
        const userWithNewShift = Array.from(userShiftMap.entries()).find(
            ([uid, data]) => uid !== userId && data.shiftId === newShiftId
        );

        if (userWithNewShift && currentUserShift && !skipConfirm) {
            // Swap case: Both users have shifts and we're swapping them
            const [otherUserId] = userWithNewShift;
            const otherUser = users.find(u => u.id === otherUserId);

            if (window.confirm(`Swap shifts with ${otherUser?.name}?`)) {
                swapShiftMutation.mutate({
                    user1Id: userId,
                    user2Id: otherUserId,
                    startDate: format(weekStart, "yyyy-MM-dd"),
                });
            }
        } else {
            // Simple assignment
            updateShiftMutation.mutate({
                userId,
                shiftId: newShiftId,
                startDate: format(weekStart, "yyyy-MM-dd"),
            });
            if (!skipConfirm) {
                toast.success("Shift updated successfully");
            }
        }
    };

    return (
        <Card className="h-full">
            <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                        <CardTitle>Shift Scheduler</CardTitle>
                        <CardDescription className="hidden sm:block">
                            Manage weekly shift assignments for all users.
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCopyDialog(true)}
                        className="gap-2 w-full sm:w-auto"
                    >
                        <FaCopy className="h-4 w-4" />
                        <span className="sm:inline">Copy Previous Week</span>
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 md:space-y-6">
                {/* Week Selector */}
                <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedDate(subWeeks(selectedDate, 1))}>
                        <FaSort className="h-4 w-4 rotate-90" />
                    </Button>
                    <div className="text-center">
                        <div className="font-semibold">
                            {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
                        </div>
                        <div className="text-xs text-muted-foreground">Week View</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedDate(addWeeks(selectedDate, 1))}>
                        <FaSort className="h-4 w-4 -rotate-90" />
                    </Button>
                </div>

                {/* Shifts List */}
                <div className="space-y-4">
                    {shifts.map((shift) => (
                        <ShiftRow
                            key={shift.id}
                            shift={shift}
                            assignedUsers={shiftAssignments[shift.id] || []}
                            availableUsers={availableUsers}
                            allShifts={shifts}
                            weekShifts={weekShifts}
                            onAddUsers={(userIds) => handleAddUsersToShift(shift.id, userIds)}
                            onRemoveUser={handleRemoveUser}
                            onChangeShift={handleChangeUserShift}
                            isLoading={updateShiftMutation.isPending || removeUserMutation.isPending || swapShiftMutation.isPending}
                        />
                    ))}
                </div>

                {/* Unassigned Users */}
                {availableUsers.length > 0 && (
                    <div className="border-t pt-4">
                        <Label className="text-muted-foreground">Unassigned Users ({availableUsers.length})</Label>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {availableUsers.map((user) => (
                                <Badge key={user.id} variant="outline">
                                    {user.name}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>

            {/* Copy Previous Week Dialog */}
            <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Copy Previous Week</DialogTitle>
                        <DialogDescription>
                            This will copy all shift assignments from the previous week to the current week.
                            Any existing assignments for this week will be replaced.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCopyDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCopyPreviousWeek}
                            disabled={copyPreviousWeekMutation.isPending}
                        >
                            {copyPreviousWeekMutation.isPending ? "Copying..." : "Confirm"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
};

// ShiftRow Component
interface ShiftRowProps {
    shift: Shift;
    assignedUsers: User[];
    availableUsers: User[];
    allShifts: Shift[];
    weekShifts: any[];
    onAddUsers: (userIds: string[]) => void;
    onRemoveUser: (userId: string) => void;
    onChangeShift: (userId: string, newShiftId: string, skipConfirm?: boolean) => void;
    isLoading: boolean;
}

const ShiftRow: React.FC<ShiftRowProps> = ({
    shift,
    assignedUsers,
    availableUsers,
    allShifts,
    weekShifts,
    onAddUsers,
    onRemoveUser,
    onChangeShift,
    isLoading,
}) => {
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [bulkShiftId, setBulkShiftId] = useState("");
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkChangeMode, setBulkChangeMode] = useState<"swap" | "add">("swap");
    const [isExpanded, setIsExpanded] = useState(false);

    const COLLAPSE_THRESHOLD = 5;
    const visibleUsers = isExpanded ? assignedUsers : assignedUsers.slice(0, COLLAPSE_THRESHOLD);
    const hiddenCount = assignedUsers.length - COLLAPSE_THRESHOLD;

    const toggleUserSelection = (userId: string) => {
        setSelectedUsers((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId]
        );
    };

    const handleAddUsers = () => {
        if (selectedUsers.length === 0) return;
        onAddUsers(selectedUsers);
        setSelectedUsers([]);
        setIsComboboxOpen(false);
    };

    const handleBulkShiftChangeClick = () => {
        if (!bulkShiftId || assignedUsers.length === 0) return;
        setBulkChangeMode("swap"); // Default to swap
        setShowBulkModal(true);
    };

    const handleConfirmBulkChange = async () => {
        const targetShift = allShifts.find(s => s.id === bulkShiftId);
        if (!targetShift) return;

        try {
            if (bulkChangeMode === "swap") {
                // TRUE SWAP: Exchange all users between the two shifts
                // 1. Get users currently in the target shift
                const targetShiftUsers = weekShifts
                    .filter((ws: any) => ws.shiftId === bulkShiftId)
                    .map((ws: any) => ws.user);

                // 2. Move source shift users to target shift
                await Promise.all(assignedUsers.map(user =>
                    onChangeShift(user.id, bulkShiftId, true)
                ));

                // 3. Move target shift users to source shift (completing the swap)
                if (targetShiftUsers.length > 0) {
                    await Promise.all(targetShiftUsers.map((user: any) =>
                        onChangeShift(user.id, shift.id, true)
                    ));
                }

                toast.success(`Swapped ${assignedUsers.length} user(s) with ${targetShiftUsers.length} user(s)`);
            } else {
                // ADD TO LIST: Just move users to target shift (no swap)
                await Promise.all(assignedUsers.map(user =>
                    onChangeShift(user.id, bulkShiftId, true)
                ));
                toast.success(`${assignedUsers.length} user(s) moved successfully`);
            }
        } catch (error) {
            // Error toast is already handled by mutation
        }

        setShowBulkModal(false);
        setBulkShiftId("");
    };

    return (
        <>
            <div className="border rounded-lg p-3 md:p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center justify-between sm:justify-start gap-2 flex-1">
                        <div>
                            <h3 className="font-semibold">{shift.name}</h3>
                            {shift.startTime && shift.endTime && (
                                <p className="text-xs md:text-sm text-muted-foreground">
                                    {shift.startTime} - {shift.endTime}
                                </p>
                            )}
                        </div>
                        <Badge variant="secondary" className="sm:hidden">
                            {assignedUsers.length}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <Badge variant="secondary" className="hidden sm:inline-flex shrink-0">
                            {assignedUsers.length} {assignedUsers.length === 1 ? 'user' : 'users'}
                        </Badge>
                        {assignedUsers.length > 0 && (
                            <div className="flex items-center gap-2 flex-1 sm:flex-none min-w-0">
                                <Select
                                    value={bulkShiftId}
                                    onChange={(e) => setBulkShiftId(e.target.value)}
                                    disabled={isLoading}
                                    className="text-xs h-10 w-full sm:w-[140px]"
                                >
                                    <option value="">Change all...</option>
                                    {allShifts
                                        .filter(s => s.id !== shift.id)
                                        .map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}
                                            </option>
                                        ))}
                                </Select>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleBulkShiftChangeClick}
                                    disabled={!bulkShiftId || isLoading}
                                    className="h-10 text-xs px-3 shrink-0"
                                >
                                    Apply
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Assigned Users as Simple Badges */}
                <div className="flex flex-wrap gap-1.5 min-h-[40px] items-center">
                    {assignedUsers.length === 0 ? (
                        <span className="text-sm text-muted-foreground italic">No users assigned</span>
                    ) : (
                        <>
                            {visibleUsers.map((user) => (
                                <UserBadge
                                    key={user.id}
                                    user={user}
                                    onRemove={() => onRemoveUser(user.id)}
                                    isLoading={isLoading}
                                />
                            ))}
                            {assignedUsers.length > COLLAPSE_THRESHOLD && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                                >
                                    {isExpanded ? (
                                        <>Show less</>
                                    ) : (
                                        <>+ {hiddenCount} more</>
                                    )}
                                </Button>
                            )}
                        </>
                    )}
                </div>

                {/* Add Users */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                size="sm"
                                className="flex-1 justify-between"
                            >
                                {selectedUsers.length > 0
                                    ? `${selectedUsers.length} user(s) selected`
                                    : "Add users..."}
                                <FaSort className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search users..." />
                                <CommandList>
                                    <CommandEmpty>No available users found.</CommandEmpty>
                                    <CommandGroup>
                                        {availableUsers.map((user) => (
                                            <CommandItem
                                                key={user.id}
                                                value={user.name}
                                                onSelect={() => toggleUserSelection(user.id)}
                                            >
                                                <div className={cn(
                                                    "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                    selectedUsers.includes(user.id)
                                                        ? "bg-primary text-primary-foreground"
                                                        : "opacity-50 [&_svg]:invisible"
                                                )}>
                                                    <FaCheck className={cn("h-4 w-4")} />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span>{user.name}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {user.mobile || user.email}
                                                    </span>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    <Button
                        size="sm"
                        onClick={handleAddUsers}
                        disabled={selectedUsers.length === 0 || isLoading}
                    >
                        Add
                    </Button>
                </div>
            </div>

            {/* Bulk Change Modal */}
            <Dialog open={showBulkModal} onOpenChange={setShowBulkModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change All Users</DialogTitle>
                        <DialogDescription>
                            Move all {assignedUsers.length} users from <strong>{shift.name}</strong> to{" "}
                            <strong>{allShifts.find(s => s.id === bulkShiftId)?.name}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name="bulkMode"
                                    value="swap"
                                    checked={bulkChangeMode === "swap"}
                                    onChange={() => setBulkChangeMode("swap")}
                                    className="h-4 w-4"
                                />
                                <div>
                                    <div className="font-medium">Swap</div>
                                    <div className="text-sm text-muted-foreground">
                                        Exchange users between the two shifts
                                    </div>
                                </div>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="radio"
                                    name="bulkMode"
                                    value="add"
                                    checked={bulkChangeMode === "add"}
                                    onChange={() => setBulkChangeMode("add")}
                                    className="h-4 w-4"
                                />
                                <div>
                                    <div className="font-medium">Add to list</div>
                                    <div className="text-sm text-muted-foreground">
                                        Move users to the target shift (no swap)
                                    </div>
                                </div>
                            </label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowBulkModal(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleConfirmBulkChange}>
                            Confirm
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};

// Simple UserBadge Component (restored original)
interface UserBadgeProps {
    user: User;
    onRemove: () => void;
    isLoading: boolean;
}

const UserBadge: React.FC<UserBadgeProps> = ({
    user,
    onRemove,
    isLoading,
}) => {
    return (
        <Badge
            variant="secondary"
            className="pl-1.5 pr-0.5 py-0.5 text-xs"
        >
            {user.name}
            <Button
                variant="ghost"
                size="icon"
                className="h-3.5 w-3.5 ml-1 hover:bg-transparent text-muted-foreground hover:text-destructive"
                onClick={(e) => {
                    e.stopPropagation();
                    onRemove();
                }}
                disabled={isLoading}
            >
                <FaTimes className="h-2.5 w-2.5" />
            </Button>
        </Badge>
    );
};


