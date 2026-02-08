import React, { useState, useMemo } from "react";
import { format, startOfWeek, addWeeks, subWeeks } from "date-fns";
import { FaSort } from "react-icons/fa";
import {
    Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
    Select, Badge
} from "./ui";
import { User, Shift } from "../types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getShiftsForWeek, updateUserShift, swapUserShifts } from "../services/api";
import { toast } from "react-hot-toast";

interface UserShiftListProps {
    users: User[];
    shifts: Shift[];
}

export const UserShiftList: React.FC<UserShiftListProps> = ({ users, shifts }) => {
    const [selectedDate, setSelectedDate] = useState(new Date());
    const queryClient = useQueryClient();

    // Ensure Monday start
    const weekStart = useMemo(() => startOfWeek(selectedDate, { weekStartsOn: 1 }), [selectedDate]);

    const { data: weekShifts = [], isLoading } = useQuery({
        queryKey: ["week-shifts", format(weekStart, "yyyy-MM-dd")],
        queryFn: () => getShiftsForWeek(format(weekStart, "yyyy-MM-dd")),
    });

    // Create a map of userId to their shift for this week
    const userShiftMap = useMemo(() => {
        const map = new Map<string, { shiftId: string; shift: Shift }>();
        weekShifts.forEach((ws: any) => {
            map.set(ws.userId, { shiftId: ws.shiftId, shift: ws.shift });
        });
        return map;
    }, [weekShifts]);

    const updateShiftMutation = useMutation({
        mutationFn: updateUserShift,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["week-shifts"] });
            toast.success("Shift updated successfully");
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

    const handleShiftChange = (userId: string, newShiftId: string) => {
        if (!newShiftId) return; // No shift selected

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

        if (userWithNewShift && currentUserShift) {
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
            // Simple assignment: Either user has no shift or target shift is unoccupied
            updateShiftMutation.mutate({
                userId,
                shiftId: newShiftId,
                startDate: format(weekStart, "yyyy-MM-dd"),
            });
        }
    };

    const isUpdating = updateShiftMutation.isPending || swapShiftMutation.isPending;

    // Get users with their shift info for display
    const userRows = useMemo(() => {
        return users.map(user => {
            const userShift = userShiftMap.get(user.id);
            return {
                user,
                currentShift: userShift?.shift,
                currentShiftId: userShift?.shiftId,
            };
        });
    }, [users, userShiftMap]);

    return (
        <Card className="h-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>User Shift Assignments</CardTitle>
                        <CardDescription>
                            View and manage shift assignments for all users. Change a user's shift to swap with another user.
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Week Selector */}
                <div className="flex items-center justify-between bg-muted/50 p-3 rounded-lg">
                    <Button variant="ghost" size="icon" onClick={() => setSelectedDate(subWeeks(selectedDate, 1))}>
                        <FaSort className="h-4 w-4 rotate-90" />
                    </Button>
                    <div className="text-center">
                        <div className="font-semibold">
                            Week of {format(weekStart, "MMM d, yyyy")}
                        </div>
                        <div className="text-xs text-muted-foreground">User Shift List</div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setSelectedDate(addWeeks(selectedDate, 1))}>
                        <FaSort className="h-4 w-4 -rotate-90" />
                    </Button>
                </div>

                {/* User List Table */}
                <div className="border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-muted/50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-sm font-medium">User Name</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Contact</th>
                                    <th className="px-4 py-3 text-left text-sm font-medium">Current Shift</th>
                                    <th className="px-4 py-3 text-right text-sm font-medium">Change Shift</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-muted-foreground">
                                            Loading shifts...
                                        </td>
                                    </tr>
                                ) : userRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="text-center py-8 text-muted-foreground">
                                            No users found
                                        </td>
                                    </tr>
                                ) : (
                                    userRows.map(({ user, currentShift, currentShiftId }) => {
                                        // Check if selecting this shift would trigger a swap
                                        const getSwapInfo = (shiftId: string) => {
                                            const otherUserWithShift = Array.from(userShiftMap.entries()).find(
                                                ([uid, data]) => uid !== user.id && data.shiftId === shiftId
                                            );
                                            if (otherUserWithShift && currentShift) {
                                                const otherUser = users.find(u => u.id === otherUserWithShift[0]);
                                                return otherUser;
                                            }
                                            return null;
                                        };

                                        return (
                                            <tr key={user.id} className="hover:bg-muted/30">
                                                <td className="px-4 py-3 font-medium">{user.name}</td>
                                                <td className="px-4 py-3 text-sm text-muted-foreground">
                                                    {user.mobile || user.email || "-"}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {currentShift ? (
                                                        <Badge variant="secondary">
                                                            {currentShift.name}
                                                            {currentShift.startTime && currentShift.endTime && (
                                                                <span className="ml-2 text-xs opacity-70">
                                                                    {currentShift.startTime} - {currentShift.endTime}
                                                                </span>
                                                            )}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-sm text-muted-foreground italic">No shift assigned</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <Select
                                                        value={currentShiftId || ""}
                                                        onChange={(e) => handleShiftChange(user.id, e.target.value)}
                                                        disabled={isUpdating}
                                                        className="w-[200px] ml-auto"
                                                    >
                                                        <option value="">Select shift...</option>
                                                        {shifts.map((shift) => {
                                                            const swapUser = getSwapInfo(shift.id);
                                                            return (
                                                                <option key={shift.id} value={shift.id}>
                                                                    {shift.name}
                                                                    {swapUser ? ` (Swap with ${swapUser.name})` : ''}
                                                                </option>
                                                            );
                                                        })}
                                                    </Select>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Stats Summary */}
                <div className="flex gap-4 text-sm text-muted-foreground">
                    <div>
                        Total Users: <span className="font-medium text-foreground">{users.length}</span>
                    </div>
                    <div>
                        Assigned: <span className="font-medium text-foreground">{userShiftMap.size}</span>
                    </div>
                    <div>
                        Unassigned: <span className="font-medium text-foreground">{users.length - userShiftMap.size}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

