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
        mutationFn: ({ userId, date, skipToast }: { userId: string; date: string; skipToast?: boolean }) =>
            removeUserShift(userId, date),
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["week-shifts"] });
            if (!variables.skipToast) {
                toast.success("User removed successfully");
            }
        },
        onError: (error: any, variables) => {
            if (!variables.skipToast) {
                toast.error(error.response?.data?.message || "Failed to remove user");
            }
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
            const shiftUsers = weekShifts
                .filter((ws: any) => ws.shiftId === shift.id)
                .map((ws: any) => ws.user);

            assignments[shift.id] = shiftUsers.sort((a: User, b: User) => a.name.localeCompare(b.name));
        });

        return assignments;
    }, [weekShifts, shifts]);

    // Get assigned user IDs
    const assignedUserIds = useMemo(() => {
        return new Set(weekShifts.map((ws: any) => ws.userId));
    }, [weekShifts]);

    // Get available users (not assigned to any shift this week)
    const availableUsers = useMemo(() => {
        return users
            .filter((user) => !assignedUserIds.has(user.id))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [users, assignedUserIds]);

    const handleCopyPreviousWeek = () => {
        copyPreviousWeekMutation.mutate(format(weekStart, "yyyy-MM-dd"));
    };

    const handleRemoveUser = (userId: string, skipToast = false) => {
        return removeUserMutation.mutateAsync({
            userId,
            date: format(weekStart, "yyyy-MM-dd"),
            skipToast
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
    onRemoveUser: (userId: string, skipToast?: boolean) => Promise<any>;
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
    const [bulkChangeMode, setBulkChangeMode] = useState<"swap" | "add">("add");
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedActionUsers, setSelectedActionUsers] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

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
        if (assignedUsers.length === 0) return;
        setBulkShiftId("");
        setBulkChangeMode("add");
        setSelectedActionUsers([]);
        setShowBulkModal(true);
    };

    const toggleActionUser = (userId: string) => {
        setSelectedActionUsers(prev =>
            prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
        );
    };

    const getTargetUsers = () => {
        if (!bulkShiftId) return [];
        return weekShifts
            .filter((ws: any) => ws.shiftId === bulkShiftId)
            .map((ws: any) => ws.userId);
    };

    const handleConfirmBulkChange = async (type: "move_selected" | "move_all" | "swap_selected" | "swap_all") => {
        if (!bulkShiftId) return;

        const targetShift = allShifts.find(s => s.id === bulkShiftId);
        if (!targetShift) return;

        const usersToProcess = (type === "move_selected" || type === "swap_selected")
            ? assignedUsers.filter(u => selectedActionUsers.includes(u.id))
            : assignedUsers;

        if (usersToProcess.length === 0) return;

        try {
            if (type === "swap_selected" || type === "swap_all") {
                const targetShiftUsers = getTargetUsers();

                // Move source shift users to target shift
                await Promise.all(usersToProcess.map(user =>
                    onChangeShift(user.id, bulkShiftId, true)
                ));

                // Move target shift users to source shift (completing the swap)
                if (targetShiftUsers.length > 0) {
                    await Promise.all(targetShiftUsers.map((user: any) =>
                        onChangeShift(user.id, shift.id, true)
                    ));
                }

                toast.success(`Swapped ${usersToProcess.length} user(s) with ${targetShiftUsers.length} user(s)`);
            } else {
                // ADD TO LIST
                await Promise.all(usersToProcess.map(user =>
                    onChangeShift(user.id, bulkShiftId, true)
                ));
                toast.success(`${usersToProcess.length} user(s) moved successfully`);
            }
        } catch (error) {
            // Error toast is already handled by mutation
        }

        setShowBulkModal(false);
        setBulkShiftId("");
        setSelectedActionUsers([]);
    };

    const handleRemoveSelected = async () => {
        if (selectedActionUsers.length === 0) return;

        const removePromise = Promise.all(
            selectedActionUsers.map(userId => onRemoveUser(userId, true))
        );

        toast.promise(removePromise, {
            loading: "Removing selected users...",
            success: `Successfully removed ${selectedActionUsers.length} user(s)`,
            error: "Failed to remove some users",
        });

        try {
            await removePromise;
            setShowBulkModal(false);
            setBulkShiftId("");
            setSelectedActionUsers([]);
        } catch (error) {
            // Error logged/toasted by promise
        }
    };

    const handleRemoveAll = async () => {
        if (assignedUsers.length === 0) return;
        if (!window.confirm(`Are you sure you want to completely remove all ${assignedUsers.length} users from this shift?`)) return;

        const removeAllPromise = Promise.all(
            assignedUsers.map(user => onRemoveUser(user.id, true))
        );

        toast.promise(removeAllPromise, {
            loading: "Removing all users...",
            success: `Successfully removed all ${assignedUsers.length} users`,
            error: "Failed to remove all users",
        });

        try {
            await removeAllPromise;
        } catch (error) {
            // Error logged/toasted by promise
        }
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
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
                        <Badge variant="secondary" className="hidden sm:inline-flex shrink-0">
                            {assignedUsers.length} {assignedUsers.length === 1 ? 'user' : 'users'}
                        </Badge>
                        {assignedUsers.length > 0 && (
                            <div className="flex gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleBulkShiftChangeClick}
                                    disabled={isLoading}
                                    className="h-9 text-xs px-3 flex-1 sm:flex-none"
                                >
                                    Manage Users
                                </Button>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={handleRemoveAll}
                                    disabled={isLoading}
                                    className="h-9 text-xs px-3 flex-1 sm:flex-none"
                                >
                                    Remove All
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
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Manage Shift Users</DialogTitle>
                        <DialogDescription>
                            Select users and a target shift to move or swap.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Mode Selection Buttons at Top */}
                    <div className="flex gap-2">
                        <Button
                            variant={bulkChangeMode === "add" ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => setBulkChangeMode("add")}
                        >
                            Move Users
                        </Button>
                        <Button
                            variant={bulkChangeMode === "swap" ? "default" : "outline"}
                            className="flex-1"
                            onClick={() => setBulkChangeMode("swap")}
                        >
                            Swap Users
                        </Button>
                    </div>

                    <div className="space-y-4 py-2">
                        {/* Target Shift Selector */}
                        <div className="space-y-2">
                            <Label>Target Shift</Label>
                            <Select
                                value={bulkShiftId}
                                onChange={(e) => setBulkShiftId(e.target.value)}
                                disabled={isLoading}
                                className="w-full h-10"
                            >
                                <option value="">Select a shift...</option>
                                {allShifts
                                    .filter(s => s.id !== shift.id)
                                    .map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.name}
                                        </option>
                                    ))}
                            </Select>
                        </div>

                        {/* User List in Alphabetical Order */}
                        <div className="space-y-2">
                            <Label>Select Users</Label>
                            {assignedUsers.length > 0 && (
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Search users..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    />
                                    {searchQuery && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setSearchQuery("")}
                                            className="absolute right-0 top-0 h-9 w-9 text-muted-foreground hover:text-foreground"
                                        >
                                            <FaTimes className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                            )}
                            <div className="max-h-[200px] overflow-y-auto border rounded-md p-2 space-y-1">
                                {assignedUsers
                                    .filter(user => user.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                    .slice()
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map(user => (
                                        <label key={user.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={selectedActionUsers.includes(user.id)}
                                                onChange={() => toggleActionUser(user.id)}
                                                className="h-4 w-4 rounded border-primary"
                                            />
                                            <span className="text-sm font-medium">{user.name}</span>
                                        </label>
                                    ))}
                                {assignedUsers.length === 0 && (
                                    <div className="p-2 text-sm text-muted-foreground italic">No users assigned to this shift.</div>
                                )}
                                {assignedUsers.length > 0 && assignedUsers.filter(user => user.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                    <div className="p-2 text-sm text-muted-foreground italic">No users found matching "{searchQuery}".</div>
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex flex-col gap-2 mt-4 sm:flex-row sm:items-center sm:justify-end w-full">
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-wrap justify-end">
                            <Button variant="outline" onClick={() => setShowBulkModal(false)} className="w-full sm:w-auto order-last sm:order-first">
                                Cancel
                            </Button>
                            {selectedActionUsers.length > 0 && (
                                <Button
                                    variant="destructive"
                                    onClick={handleRemoveSelected}
                                    disabled={isLoading}
                                    className="w-full sm:w-auto text-xs px-3"
                                >
                                    Remove Selected
                                </Button>
                            )}
                            {bulkChangeMode === "add" ? (
                                <>
                                    <Button
                                        onClick={() => handleConfirmBulkChange("move_selected")}
                                        disabled={!bulkShiftId || selectedActionUsers.length === 0 || isLoading}
                                        variant="secondary"
                                        className="w-full sm:w-auto text-xs px-3"
                                    >
                                        Move Selected
                                    </Button>
                                    <Button
                                        onClick={() => handleConfirmBulkChange("move_all")}
                                        disabled={!bulkShiftId || assignedUsers.length === 0 || isLoading}
                                        className="w-full sm:w-auto text-xs px-3"
                                    >
                                        Move All
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        onClick={() => handleConfirmBulkChange("swap_selected")}
                                        disabled={!bulkShiftId || selectedActionUsers.length === 0 || isLoading}
                                        variant="secondary"
                                        className="w-full sm:w-auto text-xs px-3"
                                    >
                                        Swap Selected
                                    </Button>
                                    <Button
                                        onClick={() => handleConfirmBulkChange("swap_all")}
                                        disabled={!bulkShiftId || assignedUsers.length === 0 || isLoading}
                                        className="w-full sm:w-auto text-xs px-3"
                                    >
                                        Swap All
                                    </Button>
                                </>
                            )}
                        </div>
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


