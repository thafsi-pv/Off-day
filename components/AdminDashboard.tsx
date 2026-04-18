import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
} from "recharts";
import { format, startOfWeek, parseISO, addDays } from "date-fns";
import { toast } from "react-hot-toast";
import jsPDF from "jspdf";
import "jspdf-autotable";
import { User, Config, Leave, LeaveStatus, Shift, UserStatus, Role } from "../types";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Checkbox,
} from "./ui";
import {
  BarChartIcon,
  ListIcon,
  SettingsIcon,
  DownloadIcon,
  UsersIcon,
  KeyIcon,
  ChevronsUpDownIcon,
  CheckIcon,
  HomeIcon,
} from "./icons";
import UserDashboard from "./UserDashboard";
import {
  useAllLeaves,
  useUpdateLeaveStatusMutation,
  useUpdateMultipleLeaveStatusesMutation,
  useCreateLeaveMutation,
  useSlotInfoForDate,
} from "../hooks/useLeaves";
import { useConfig, useUpdateConfigMutation } from "../hooks/useConfig";
import {
  useAllUsers,
  useUpdateUserStatusMutation,
  useResetUserPasswordMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
  useShiftsForWeek,
} from "../hooks/useUsers";
import PhoneInput from "react-phone-input-2";
import { formatDate } from "../utils/date";
import { ShiftManagement } from "./ShiftManagement";
import { BOOKING_CONSTANTS } from "../utils/constants";

const getStatusBadge = (status: LeaveStatus | "NOT APPLIED") => {
  switch (status) {
    case LeaveStatus.APPROVED:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case LeaveStatus.REJECTED:
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case "NOT APPLIED":
      return "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/40 dark:text-red-300";
    case LeaveStatus.PENDING:
    default:
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
  }
};



const Skeleton = ({ className }: { className?: string }) => (
  <div className={`animate-pulse rounded-md bg-muted ${className}`} />
);



const CreateLeave: React.FC<{
  users: User[];
  config: Config;
  onCreate: (data: { userId: string; date: string; shiftId: string; status?: LeaveStatus; creatorId?: string }) => void;
  isLoading: boolean;
}> = ({ users, config, onCreate, isLoading }) => {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [openUserCombobox, setOpenUserCombobox] = useState(false);

  const { data: slotInfo } = useSlotInfoForDate(selectedDate, {
    enabled: !!selectedDate,
  });

  const activeUsers = useMemo(() => {
    return users
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users]);

  const selectedUser = useMemo(() => {
    return activeUsers.find((u) => u.id === selectedUserId);
  }, [activeUsers, selectedUserId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedUserId) {
      toast.error("Please select a user");
      return;
    }
    if (!selectedDate) {
      toast.error("Please select a date");
      return;
    }
    if (!selectedShiftId) {
      toast.error("Please select a shift");
      return;
    }

    onCreate({
      userId: selectedUserId,
      date: selectedDate,
      shiftId: selectedShiftId,
      status: LeaveStatus.APPROVED,
      creatorId: "admin", // This will be handled in the parent handleCreateLeave
    });


    // Reset form
    setSelectedUserId("");
    setSelectedDate("");
    setSelectedShiftId("");
  };

  const minDate = (() => {
    const now = new Date();
    const istNow = new Date(now.getTime() + BOOKING_CONSTANTS.IST_OFFSET_MS);

    const day = istNow.getUTCDay(); // 0=Sunday (in IST)
    const hour = istNow.getUTCHours(); // (in IST)
    const minute = istNow.getUTCMinutes(); // (in IST)

    const [resetHour, resetMinute] = BOOKING_CONSTANTS.WEEKLY_RESET_TIME.split(':').map(Number);

    let virtualToday = new Date(istNow);
    if (day === BOOKING_CONSTANTS.WEEKLY_RESET_DAY && (hour < resetHour || (hour === resetHour && minute < resetMinute))) {
      // It's Sunday before 15:30 IST, stay on Saturday's schedule
      virtualToday.setUTCDate(virtualToday.getUTCDate() - 1);
    }
    return virtualToday.toISOString().split("T")[0];
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Leave for User</CardTitle>
        <CardDescription>
          Administrators can create approved leave requests on behalf of users.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="user-select">Select User *</Label>
            <Popover open={openUserCombobox} onOpenChange={setOpenUserCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openUserCombobox}
                  className="w-full justify-between">
                  {selectedUser
                    ? `${selectedUser.name} (${formatMobileNumber(selectedUser.mobile || "") || selectedUser.email})`
                    : "Search and select user..."}
                  <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search user by name or number..." />
                  <CommandList>
                    <CommandEmpty>No user found.</CommandEmpty>
                    <CommandGroup>
                      {activeUsers.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={`${user.name} ${user.mobile} ${user.email} ${user.id}`.toLowerCase()}
                          onSelect={() => {
                            setSelectedUserId(user.id);
                            setOpenUserCombobox(false);
                            toast.success(`Selected ${user.name}`);
                          }}>
                          <CheckIcon
                            className={`mr-2 h-4 w-4 ${selectedUserId === user.id ? "opacity-100" : "opacity-0"
                              }`}
                          />
                          <div className="flex flex-col">
                            <span className="font-medium">{user.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatMobileNumber(user.mobile || "") || user.email || "N/A"}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="leave-date">Leave Date *</Label>
            <Input
              id="leave-date"
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedShiftId(""); // Reset shift when date changes
              }}
              min={minDate}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="shift-select">Select Shift *</Label>
            <Select
              id="shift-select"
              value={selectedShiftId}
              onChange={(e) => setSelectedShiftId(e.target.value)}
              required
              disabled={!selectedDate}
            >
              <option value="">-- Choose a shift --</option>
              {config.shifts.map((shift) => {
                const slot = slotInfo?.find((s) => s.shiftId === shift.id);
                const available = slot ? slot.availableSlots : shift.slots;
                const isFull = available <= 0;

                return (
                  <option key={shift.id} value={shift.id} disabled={isFull}>
                    {shift.name} ({available} slots available)
                  </option>
                );
              })}
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelectedUserId("");
                setSelectedDate("");
                setSelectedShiftId("");
              }}
              disabled={isLoading}>
              Clear
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Leave"}
            </Button>
          </div>
        </form>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> Leaves created by administrators are automatically approved and will appear in the user's leave history.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

const LeaveManagement: React.FC<{
  leaves: Leave[];
  onStatusChange: (
    leaveId: string,
    status: LeaveStatus.APPROVED | LeaveStatus.REJECTED,
    reason?: string
  ) => void;
  onBulkStatusChange: (variables: {
    leaveIds: string[];
    status: LeaveStatus.APPROVED | LeaveStatus.REJECTED;
  }) => void;
  isActionLoading: boolean;
}> = ({ leaves, onStatusChange, onBulkStatusChange, isActionLoading }) => {
  const [filterStatus, setFilterStatus] = useState<LeaveStatus | "ALL">(
    LeaveStatus.PENDING
  );
  const [selectedLeaves, setSelectedLeaves] = useState<string[]>([]);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectLeaveId, setRejectLeaveId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const filteredLeaves = useMemo(() => {
    return leaves
      .filter((l) => {
        const matchesStatus = filterStatus === "ALL" || l.status === filterStatus;
        const matchesSearch =
          l.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (l.userMobile && l.userMobile.includes(searchQuery));
        return matchesStatus && matchesSearch;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [leaves, filterStatus, searchQuery]);

  const selectableLeaves = useMemo(
    () => filteredLeaves.filter((l) => l.status === LeaveStatus.PENDING),
    [filteredLeaves]
  );

  useEffect(() => {
    setSelectedLeaves([]);
  }, [filterStatus]);

  const handleToggleSelect = (leaveId: string) => {
    setSelectedLeaves((prev) =>
      prev.includes(leaveId)
        ? prev.filter((id) => id !== leaveId)
        : [...prev, leaveId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedLeaves.length === selectableLeaves.length) {
      setSelectedLeaves([]);
    } else {
      setSelectedLeaves(selectableLeaves.map((l) => l.id));
    }
  };

  const handleBulkAction = (
    status: LeaveStatus.APPROVED | LeaveStatus.REJECTED
  ) => {
    onBulkStatusChange({ leaveIds: selectedLeaves, status });
    setSelectedLeaves([]);
  };

  const handleRejectClick = (leaveId: string) => {
    setRejectLeaveId(leaveId);
    setRejectReason("");
    setShowRejectDialog(true);
  };

  const handleConfirmReject = () => {
    if (rejectLeaveId) {
      onStatusChange(rejectLeaveId, LeaveStatus.REJECTED, rejectReason.trim() || undefined);
      setShowRejectDialog(false);
      setRejectLeaveId(null);
      setRejectReason("");
    }
  };

  const handleCancelReject = () => {
    setShowRejectDialog(false);
    setRejectLeaveId(null);
    setRejectReason("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Leave Requests</CardTitle>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <CardDescription>Approve or reject leave requests.</CardDescription>
          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <Input
              placeholder="Search by name or mobile..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64"
            />
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full sm:w-48">
              <option value="ALL">All Statuses</option>
              <option value={LeaveStatus.PENDING}>Pending</option>
              <option value={LeaveStatus.APPROVED}>Approved</option>
              <option value={LeaveStatus.REJECTED}>Rejected</option>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {selectedLeaves.length > 0 && (
          <div className="p-4 bg-muted border-b rounded-t-lg flex items-center gap-4 dark:border-border/50">
            <p className="text-sm font-semibold flex-grow">
              {selectedLeaves.length} selected
            </p>
            <Button
              size="sm"
              onClick={() => handleBulkAction(LeaveStatus.APPROVED)}
              disabled={isActionLoading}>
              Approve Selected
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleBulkAction(LeaveStatus.REJECTED)}
              disabled={isActionLoading}>
              Reject Selected
            </Button>
          </div>
        )}
        <div
          className={`border rounded-lg max-h-[60vh] overflow-y-auto dark:border-border/50 ${selectedLeaves.length > 0 ? "rounded-t-none" : ""
            }`}>
          {selectableLeaves.length > 0 && (
            <div className="flex items-center p-4 border-b bg-muted/50 sticky top-0 z-10 dark:border-border/50">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                checked={
                  selectedLeaves.length > 0 &&
                  selectedLeaves.length === selectableLeaves.length
                }
                onChange={handleToggleSelectAll}
                aria-label="Select all pending requests"
              />
              <label htmlFor="select-all" className="ml-3 text-sm font-medium">
                Select all pending
              </label>
            </div>
          )}
          {filteredLeaves.length > 0 ? (
            filteredLeaves.map((leave) => (
              <div
                key={leave.id}
                className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 border-b last:border-b-0 gap-4 dark:border-border/50">
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
                    <p className="text-sm text-muted-foreground">
                      {formatDate(leave.date)} - {leave.shiftName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full md:w-auto md:pl-8">
                  <span
                    className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusBadge(
                      leave.status
                    )}`}>
                    {leave.status}
                  </span>
                  {leave.status === LeaveStatus.PENDING && (
                    <div className="flex gap-2 ml-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onStatusChange(leave.id, LeaveStatus.APPROVED)
                        }
                        disabled={isActionLoading}>
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRejectClick(leave.id)}
                        disabled={isActionLoading}>
                        Reject
                      </Button>
                    </div>
                  )}
                  {leave.status === LeaveStatus.APPROVED && (
                    <div className="flex gap-2 ml-auto">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRejectClick(leave.id)}
                        disabled={isActionLoading}>
                        Revoke
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="p-6 text-center">
              No leaves match the current filter.
            </p>
          )}
        </div>

        {/* Reject Dialog */}
        {showRejectDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>Reject Leave Request</CardTitle>
                <CardDescription>
                  Provide a reason for rejecting this leave request (optional but recommended).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reject-reason">Reason for Rejection</Label>
                  <textarea
                    id="reject-reason"
                    className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background dark:border-border/50"
                    placeholder="e.g., Insufficient staffing on this date, Prior approved leave conflict, etc."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={handleCancelReject}
                    disabled={isActionLoading}>
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleConfirmReject}
                    disabled={isActionLoading}>
                    {isActionLoading ? 'Rejecting...' : 'Confirm Rejection'}
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

const NotBookedSummary: React.FC<{
  leaves: Leave[];
  startDate: string;
  endDate: string;
}> = ({ leaves, startDate, endDate }) => {
  // Use the week of the start date, or current week if not selected
  const targetDate = startDate || new Date().toISOString().split("T")[0];
  const { data: assignments, isLoading } = useShiftsForWeek(targetDate);

  const notBooked = useMemo(() => {
    if (!assignments || !Array.isArray(assignments)) return [];

    // Filter assignments to find users who don't have a leave in the system for this week
    // We assume the range in reports might overlap with this week
    const weekStart = startOfWeek(parseISO(targetDate), { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);

    return assignments.filter((assign: any) => {
      // Check if this user has ANY leave record (PENDING, APPROVED, or REJECTED) in the assigned week
      const hasAnyLeave = leaves.some((leave) => {
        const leaveDate = parseISO(leave.date);
        return (
          leave.userId === assign.user.id &&
          leaveDate >= weekStart &&
          leaveDate <= weekEnd
        );
      });
      return !hasAnyLeave;
    });
  }, [assignments, leaves, targetDate]);

  const [isExpanded, setIsExpanded] = useState(false);

  if (isLoading) return <div className="p-2 text-xs text-muted-foreground">Checking assignments...</div>;
  if (!assignments || assignments?.length === 0) return null;

  return (
    <div className="mb-6 p-4 border rounded-xl bg-red-50/50 dark:bg-red-900/10 border-red-200 dark:border-red-800/50">
      <div 
        className="flex items-center gap-2 mb-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <UsersIcon className="w-5 h-5 text-red-600" />
        <h3 className="font-bold text-red-800 dark:text-red-200">
          Not Applied for Week of {format(startOfWeek(parseISO(targetDate), { weekStartsOn: 1 }), "dd MMM yyyy")}
        </h3>
        <span className="ml-auto bg-red-600 text-white text-xs px-2 py-0.5 rounded-full">
          {notBooked.length} Persons
        </span>
        <Button variant="ghost" size="sm" className="h-6 text-xs text-red-700 hover:text-red-800 hover:bg-red-100 dark:text-red-300 dark:hover:bg-red-900/50">
          {isExpanded ? "Collapse" : "Expand"}
        </Button>
      </div>

      {isExpanded && (
        <div className="pt-2">
          {notBooked.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {notBooked.map((assign: any) => (
                <div key={assign.user.id} className="flex flex-col p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-red-100 dark:border-red-900/50">
                  <span className="font-medium text-sm">{assign.user.name}</span>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] text-muted-foreground">{assign.user.mobile || assign.user.email}</span>
                    <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded uppercase">
                      {assign.shift.name}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-green-600 dark:text-green-400 font-medium">All assigned employees have booked their leaves for this week! 🎉</p>
          )}
        </div>
      )}
    </div>
  );
};

const Reports: React.FC<{ leaves: Leave[] }> = ({ leaves }) => {
  const [startDate, setStartDate] = useState(() => {
    const start = new Date();
    start.setUTCDate(1);
    return start.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const end = new Date();
    const year = end.getUTCFullYear();
    const month = end.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0));
    return lastDay.toISOString().split("T")[0];
  });
  const [filterStatus, setFilterStatus] = useState<LeaveStatus | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showNotBooked, setShowNotBooked] = useState(true);

  const targetWeekDate = startDate || new Date().toISOString().split("T")[0];
  const { data: assignments } = useShiftsForWeek(targetWeekDate);

  const notBookedList = useMemo(() => {
    if (!assignments || !Array.isArray(assignments)) return [];
    const weekStart = startOfWeek(parseISO(targetWeekDate), { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);

    return assignments.filter((assign: any) => {
      // Synthetic rows are ONLY for people with NO entries at all. 
      // Rejected ones from the DB will show up naturally.
      const hasAnyEntry = leaves.some((leave) => {
        const leaveDate = parseISO(leave.date);
        return (
          leave.userId === assign.user.id &&
          leaveDate >= weekStart &&
          leaveDate <= weekEnd
        );
      });
      return !hasAnyEntry;
    });
  }, [assignments, leaves, targetWeekDate]);

  const filteredLeaves = useMemo(() => {
    const records = leaves
      .filter((leave) => {
        const leaveDate = new Date(leave.date);
        if (startDate && leaveDate < new Date(startDate)) return false;
        if (endDate && leaveDate > new Date(endDate)) return false;
        if (filterStatus !== "ALL" && leave.status !== filterStatus)
          return false;

        const matchesSearch =
          leave.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (leave.userMobile && leave.userMobile.includes(searchQuery));

        return matchesSearch;
      });

    const finalResults = [...records];

    if (showNotBooked && (filterStatus === "ALL" || (filterStatus as any) === "NOT_APPLIED")) {
      notBookedList.forEach(nb => {
        // Only add if it matches search
        if (!searchQuery || nb.user.name.toLowerCase().includes(searchQuery.toLowerCase()) || (nb.user.mobile && nb.user.mobile.includes(searchQuery))) {
          finalResults.push({
            id: `nb-${nb.user.id}`,
            userId: nb.user.id,
            userName: nb.user.name,
            userMobile: nb.user.mobile,
            date: targetWeekDate, // Placeholder
            shiftId: nb.shift.id,
            shiftName: nb.shift.name,
            status: "NOT APPLIED" as any,
            createdAt: new Date().toISOString(),
            reason: "No entry found for assigned week"
          });
        }
      });
    }

    return finalResults.sort((a, b) => {
      const shiftCompare = a.shiftName.localeCompare(b.shiftName);
      if (shiftCompare !== 0) return shiftCompare;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [leaves, startDate, endDate, filterStatus, searchQuery, showNotBooked, notBookedList, targetWeekDate]);

  const handleExport = (format: "CSV" | "PDF") => {
    if (format === "PDF") {
      if (filteredLeaves.length === 0) {
        toast("No data to export.");
        return;
      }
      try {
        const doc = new jsPDF();

        doc.text("Leave Report", 14, 15);

        const tableColumn = [
          "SL.No",
          "Leave Date",
          "User Name",
          "Shift",
          "Status",
          "Applied On",
        ];
        const tableRows = filteredLeaves.map((leave, index) => [
          index + 1,
          formatDate(leave.date),
          leave.userName,
          leave.shiftName,
          leave.status,
          formatDate(leave.createdAt),
        ]);

        (doc as any).autoTable({
          head: [tableColumn],
          body: tableRows,
          startY: 20,
        });

        doc.save("leave-report.pdf");
        toast.success("PDF report downloaded successfully!");
      } catch (error) {
        console.error("PDF Export Error:", error);
        const message =
          error instanceof Error ? error.message : "An unknown error occurred.";
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
        <CardDescription>
          View, filter, and export all leave records.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 p-4 border rounded-lg mb-4 bg-muted/50 dark:border-border/50">
          <div className="grid gap-2">
            <Label htmlFor="start-date">Start Date</Label>
            <Input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="end-date">End Date</Label>
            <Input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status-filter">Status</Label>
            <Select
              id="status-filter"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}>
              <option value="ALL">All Statuses</option>
              <option value={LeaveStatus.PENDING}>Pending</option>
              <option value={LeaveStatus.APPROVED}>Approved</option>
              <option value={LeaveStatus.REJECTED}>Rejected</option>
              <option value="NOT_APPLIED">Not Applied</option>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            {/* <Button onClick={() => handleExport("CSV")} variant="outline">
              <DownloadIcon className="w-4 h-4 mr-2" /> Export CSV
            </Button> */}
            <Button onClick={() => handleExport("PDF")} variant="outline">
              <DownloadIcon className="w-4 h-4 mr-2" /> Export PDF
            </Button>
          </div>
          <div className="w-full mt-2 flex flex-col sm:flex-row gap-4 items-end">
            <div className="w-full">
              <Label>Search User</Label>
              <Input
                placeholder="Search by name or mobile..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            {/* Added: Not Booked List Summary */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded border border-yellow-200 dark:border-yellow-800/50 flex-shrink-0">
              <span className="text-xs font-bold text-yellow-800 dark:text-yellow-200">
                Found {filteredLeaves.length} leave records in this range.
              </span>
            </div>
          </div>
        </div>

        {/* The summary banner remains for visibility of the specific week's missing users */}
        {showNotBooked && (
          <NotBookedSummary leaves={leaves} startDate={startDate} endDate={endDate} />
        )}
        <div className="border rounded-lg max-h-[60vh] overflow-auto dark:border-border/50">
          <table className="w-full min-w-[600px] text-sm text-left">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="p-4 font-medium w-16">SL.No</th>
                <th className="p-4 font-medium">Leave Date</th>
                <th className="p-4 font-medium">User Name</th>
                <th className="p-4 font-medium">Shift</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">Applied On</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeaves.length > 0 ? (
                filteredLeaves.map((leave, index) => (
                  <tr key={leave.id} className="border-b last:border-0 dark:border-border/50 hover:bg-muted/30">
                    <td className="p-4 font-mono">{index + 1}</td>
                    <td className="p-4">{formatDate(leave.date)}</td>
                    <td className="p-4 font-medium">{leave.userName}</td>
                    <td className="p-4">
                      <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs">
                        {leave.shiftName}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(
                          leave.status as any
                        )}`}>
                        {leave.status}
                      </span>
                      {leave.status === LeaveStatus.REJECTED && leave.reason && (
                        <p className="text-xs text-red-500 mt-1">
                          Reason: {leave.reason}
                        </p>
                      )}
                      {leave.status === ("NOT APPLIED" as any) && (
                        <p className="text-[10px] text-red-400 mt-1 italic leading-tight">
                          Assigned shift missing booking
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-xs text-muted-foreground">
                      {leave.status === ("NOT APPLIED" as any) ? "-" : formatDate(leave.createdAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="p-6 text-center text-muted-foreground">
                    No records match the current filters.
                  </td>
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
  config: Config;
  onSave: (newConfig: Config) => void;
  isLoading: boolean;
}> = ({ config, onSave, isLoading }) => {
  const [localConfig, setLocalConfig] = useState(config);

  useEffect(() => setLocalConfig(config), [config]);

  const handleDayToggle = (day: number) => {
    const disabledDays = localConfig.disabledDays.includes(day)
      ? localConfig.disabledDays.filter((d) => d !== day)
      : [...localConfig.disabledDays, day];
    setLocalConfig({ ...localConfig, disabledDays });
  };

  const handleShiftChange = (
    shiftId: string,
    field: "name" | "slots",
    value: string | number
  ) => {
    const newShifts = localConfig.shifts.map((s) =>
      s.id === shiftId
        ? {
          ...s,
          [field]: field === "slots" ? Math.max(0, Number(value)) : value,
        }
        : s
    );
    setLocalConfig({ ...localConfig, shifts: newShifts });
  };

  const handleAddShift = () => {
    const newShift: Shift = {
      id: `s${Date.now()}`,
      name: "New Shift",
      slots: 1,
    };
    setLocalConfig({
      ...localConfig,
      shifts: [...localConfig.shifts, newShift],
    });
  };

  const handleRemoveShift = (shiftId: string) => {
    setLocalConfig({
      ...localConfig,
      shifts: localConfig.shifts.filter((s) => s.id !== shiftId),
    });
  };

  const handleAddBlockedDate = (date: string) => {
    if (!date) return;
    if (localConfig.blockedDates.includes(date)) {
      toast.error("Date already blocked");
      return;
    }
    setLocalConfig({
      ...localConfig,
      blockedDates: [...localConfig.blockedDates, date].sort(),
    });
  };

  const handleRemoveBlockedDate = (date: string) => {
    setLocalConfig({
      ...localConfig,
      blockedDates: localConfig.blockedDates.filter((d) => d !== date),
    });
  };

  const handleSave = () => {
    onSave(localConfig);
  };

  const weekDays = [
    { label: "Mon", value: 1 },
    { label: "Tue", value: 2 },
    { label: "Wed", value: 3 },
    { label: "Thu", value: 4 },
    { label: "Fri", value: 5 },
    { label: "Sat", value: 6 },
    { label: "Sun", value: 0 },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Configuration</CardTitle>
        <CardDescription>
          Manage application settings for leaves.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>User Date Range (Calendar Scope)</Label>
              <Select
                value={localConfig.weekRange}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    weekRange: e.target.value as Config["weekRange"],
                  })
                }>
                <option value="1_WEEK">1 Week</option>
                <option value="2_WEEKS">2 Weeks</option>
                <option value="1_MONTH">1 Month</option>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Slot Opening Day</Label>
              <Select
                value={localConfig.openingDay}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    openingDay: Number(e.target.value),
                  })
                }>
                {weekDays.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Slot Opening Time (IST)</Label>
              <Input
                type="time"
                value={localConfig.openingTime}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    openingTime: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Notice Period (Gap Days) *</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="14"
                  value={localConfig.minNoticeDays}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      minNoticeDays: Number(e.target.value),
                    })
                  }
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  Days (e.g. 2 means 1 day gap)
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Max Leaves per Week</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="1"
                  value={localConfig.maxLeavesPerWeek === null ? "" : localConfig.maxLeavesPerWeek}
                  onChange={(e) =>
                    setLocalConfig({
                      ...localConfig,
                      maxLeavesPerWeek: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  className="w-24"
                  placeholder="Unlimited"
                />
                <span className="text-sm text-muted-foreground">
                  Leave blank for unlimited
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Disabled Weekdays</Label>
              <div className="flex gap-2 flex-wrap text-xs">
                {weekDays.map((day) => (
                  <Button
                    key={day.value}
                    size="sm"
                    variant={
                      localConfig.disabledDays.includes(day.value)
                        ? "destructive"
                        : "outline"
                    }
                    onClick={() => handleDayToggle(day.value)}>
                    {day.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Block Specific Dates (Calendar-wise)</Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  id="target-blocked-date"
                  className="flex-grow"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const el = document.getElementById("target-blocked-date") as HTMLInputElement;
                    handleAddBlockedDate(el.value);
                    el.value = "";
                  }}>
                  Block Date
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {localConfig.blockedDates?.map((date) => (
                  <span
                    key={date}
                    className="flex items-center gap-1 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-2 py-1 rounded-md text-xs">
                    {formatDate(date)}
                    <button
                      onClick={() => handleRemoveBlockedDate(date)}
                      className="hover:text-red-600 font-bold">
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t dark:border-border/50">
          <div className="flex justify-between items-center">
            <Label className="text-lg font-bold">Shifts & Slots</Label>
            <Button size="sm" onClick={handleAddShift}>
              Add Shift
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {localConfig.shifts.map((shift) => (
              <div
                key={shift.id}
                className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30 dark:border-border/50">
                <Input
                  value={shift.name}
                  onChange={(e) =>
                    handleShiftChange(shift.id, "name", e.target.value)
                  }
                  className="flex-grow"
                />
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Slots:</span>
                  <Input
                    type="number"
                    value={shift.slots}
                    onChange={(e) =>
                      handleShiftChange(shift.id, "slots", e.target.value)
                    }
                    className="w-16"
                    min="0"
                  />
                </div>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleRemoveShift(shift.id)}>
                  <span className="text-lg">×</span>
                </Button>
              </div>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={isLoading} className="w-full">
          {isLoading ? "Saving..." : "Save Configuration"}
        </Button>
      </CardContent>
    </Card>
  );
};

const getUserStatusBadge = (status: UserStatus) => {
  switch (status) {
    case UserStatus.ACTIVE:
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
    case UserStatus.INACTIVE:
      return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
    case UserStatus.PENDING:
    default:
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
  }
};

const UserManagement: React.FC = () => {
  const { data: users, isLoading, isError } = useAllUsers();
  const updateUserStatusMutation = useUpdateUserStatusMutation();
  const resetPasswordMutation = useResetUserPasswordMutation();
  const updateUserMutation = useUpdateUserMutation();
  const deleteUserMutation = useDeleteUserMutation();

  const [resetPasswordUserId, setResetPasswordUserId] = useState<string | null>(
    null
  );
  const [customPassword, setCustomPassword] = useState("");
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    mobile: string | undefined;
    email: string | undefined;
    status: UserStatus;
  }>({
    name: "",
    mobile: undefined,
    email: undefined,
    status: UserStatus.PENDING,
  });

  const handleUpdateUserStatus = (userId: string, status: UserStatus) => {
    toast
      .promise(updateUserStatusMutation.mutateAsync({ userId, status }), {
        loading: "Updating user status...",
        success: () => `User has been updated to ${status.toLowerCase()}.`,
        error: (error: any) =>
          error.response?.data?.message || "Failed to update user status.",
      })
      .catch(() => { });
  };

  const handleResetPassword = (userId: string) => {
    setResetPasswordUserId(userId);
    setCustomPassword("");
    setShowPasswordDialog(true);
  };

  const handleConfirmResetPassword = async () => {
    if (!resetPasswordUserId) return;
    const newPassword = customPassword.trim() || undefined;
    const id = toast.loading("Resetting password...");

    try {
      const data = await resetPasswordMutation.mutateAsync({
        userId: resetPasswordUserId,
        newPassword,
      });

      setShowPasswordDialog(false);
      setResetPasswordUserId(null);
      setCustomPassword("");

      toast.custom(
        (t) => (
          <div
            className={`${t.visible ? "animate-enter" : "animate-leave"
              } bg-white dark:bg-gray-900 shadow-lg rounded-xl p-4 border border-gray-200 dark:border-border/50 flex flex-col gap-3 max-w-md`}>
            <p className="text-gray-800 dark:text-white font-semibold">
              ✅ Password Reset Successful
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              {data.newPassword
                ? `New password: ${data.newPassword}`
                : data.message || "Password has been reset successfully."}
            </p>

            <div className="flex justify-end gap-3 mt-2">
              {data.newPassword && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(data.newPassword!);
                    toast.success("Copied!");
                  }}
                  className="text-sm bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 transition-all">
                  Copy
                </button>
              )}
              <button
                onClick={() => toast.dismiss(t.id)}
                className="text-sm bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-all">
                Close
              </button>
            </div>
          </div>
        ),
        {
          duration: Infinity,
          id,
        }
      );
    } catch (error: any) {
      toast.error(
        error.response?.data?.message || "Failed to reset password.",
        { id }
      );
    }
  };

  const handleCancelResetPassword = () => {
    setShowPasswordDialog(false);
    setResetPasswordUserId(null);
    setCustomPassword("");
  };

  const handleOpenEdit = (user: User) => {
    setEditUser(user);
    setEditForm({
      name: user.name,
      mobile: user.mobile || undefined,
      email: user.email || undefined,
      status: user.status,
    });
  };

  const handleDeleteUser = (user: User) => {
    if (
      confirm(
        "Are you sure you want to delete this user? This action cannot be undone."
      )
    ) {
      toast.promise(deleteUserMutation.mutateAsync({ userId: user.id }), {
        loading: "Deleting user...",
        success: () => "User deleted successfully!",
        error: (error: any) => error.response?.data?.message || "Failed to delete user.",
      });
    }
  };

  const handleEditChange = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editUser) return;
    if (
      !editForm.mobile ||
      editForm.mobile === "" ||
      editForm.mobile === undefined ||
      editForm.mobile === null
    ) {
      toast.error("Mobile number is required");
      return;
    }
    if (
      !editForm.name ||
      editForm.name === "" ||
      editForm.name === undefined ||
      editForm.name === null
    ) {
      toast.error("Name is required");
      return;
    }
    if (
      !editForm.status ||
      editForm.status === undefined ||
      editForm.status === null
    ) {
      toast.error("Status is required");
      return;
    }
    toast
      .promise(
        updateUserMutation.mutateAsync({
          userId: editUser.id,
          ...editForm,
        }),
        {
          loading: "Updating user...",
          success: () => {
            setEditUser(null);
            return "User details updated successfully!";
          },
          error: (error: any) =>
            error.response?.data?.message || "Failed to update user details.",
        }
      )
      .catch(() => { });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !users)
    return <div className="p-4 text-red-500">Failed to load users.</div>;



  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.mobile && u.mobile.includes(searchQuery))
    );
  }, [users, searchQuery]);

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    if (a.status === UserStatus.PENDING && b.status !== UserStatus.PENDING)
      return -1;
    if (a.status !== UserStatus.PENDING && b.status === UserStatus.PENDING)
      return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <div className="flex justify-between items-center">
          <CardDescription>
            Approve new registrations and manage user access.
          </CardDescription>
          <Input
            placeholder="Search by name or mobile..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-64"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg max-h-[70vh] overflow-y-auto dark:border-border/50">
          {sortedUsers.map((user) => (
            <div
              key={user.id}
              className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b last:border-b-0 gap-2 dark:border-border/50">
              <div>
                <p className="font-semibold">
                  {user.name}{" "}
                  <span className="text-sm text-muted-foreground">
                    (
                    {formatMobileNumber(user.mobile || "") ||
                      user.email ||
                      "N/A"}
                    )
                  </span>
                </p>
                <p
                  className={`mt-1 text-xs font-semibold inline-block px-2 py-0.5 rounded-full ${getUserStatusBadge(
                    user.status
                  )}`}>
                  {user.status}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenEdit(user)}
                  disabled={updateUserMutation.isPending}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDeleteUser(user)}
                  disabled={updateUserMutation.isPending}>
                  Delete
                </Button>
                {user.status === UserStatus.PENDING && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      handleUpdateUserStatus(user.id, UserStatus.ACTIVE)
                    }
                    disabled={updateUserStatusMutation.isPending}>
                    Approve
                  </Button>
                )}
                {user.status === UserStatus.ACTIVE && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResetPassword(user.id)}
                      disabled={resetPasswordMutation.isPending}
                      title="Reset Password">
                      <KeyIcon className="w-4 h-4" />
                    </Button>
                  </>
                )}
                {user.status === UserStatus.INACTIVE && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResetPassword(user.id)}
                      disabled={resetPasswordMutation.isPending}
                      title="Reset Password">
                      <KeyIcon className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Edit User Modal with PhoneInput */}
        {editUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>Edit User</CardTitle>
                <CardDescription>
                  Modify user details and save changes.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => handleEditChange("name", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Mobile</Label>
                  <PhoneInput
                    country={"in"}
                    value={editForm.mobile}
                    onChange={(value) => handleEditChange("mobile", value)}
                    inputProps={{ name: "mobile", required: true }}
                    disabled={updateUserMutation.isPending}
                    inputClass="!w-full !py-5 !text-base !rounded-md !border-gray-200 dark:!border-border/50"
                    buttonClass="!border-gray-200 dark:!border-border/50"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Email (optional)</Label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => handleEditChange("email", e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onChange={(e) =>
                      handleEditChange("status", e.target.value)
                    }>
                    <option value="ACTIVE">Approve</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="PENDING">Pending</option>
                  </Select>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setEditUser(null)}
                    disabled={updateUserMutation.isPending}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveEdit}
                    disabled={updateUserMutation.isPending}>
                    {updateUserMutation.isPending
                      ? "Saving..."
                      : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Password Reset Dialog */}
        {showPasswordDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardHeader>
                <CardTitle>Reset Password</CardTitle>
                <CardDescription>
                  Reset password for user. Leave blank to generate a random
                  password.
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
                    Minimum 6 characters. If left blank, a random 8-character
                    password will be generated.
                  </p>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={handleCancelResetPassword}
                    disabled={resetPasswordMutation.isPending}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmResetPassword}
                    disabled={
                      resetPasswordMutation.isPending ||
                      (customPassword.trim().length > 0 &&
                        customPassword.trim().length < 6)
                    }>
                    {resetPasswordMutation.isPending
                      ? "Resetting..."
                      : "Reset Password"}
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


const PermissionManagement: React.FC<{
  users: User[];
  onUpdatePermissions: (userId: string, allowedTabs: string[]) => void;
  isLoading: boolean;
}> = ({ users, onUpdatePermissions, isLoading }) => {
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [openUserCombobox, setOpenUserCombobox] = useState(false);

  // Available tabs to control access to
  const availableTabs = [
    { id: "management", label: "Leaves Management" },
    { id: "create", label: "Create Leave" },
    { id: "users", label: "User Management" },
    { id: "reports", label: "Reports" },
    { id: "settings", label: "Settings" },
    { id: "shifts", label: "Shifts" },
    { id: "roles", label: "Roles & Permissions" },
  ];

  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId);
  }, [users, selectedUserId]);

  useEffect(() => {
    if (selectedUser) {
      setSelectedTabs(selectedUser.allowedTabs || []);
    } else {
      setSelectedTabs([]);
    }
  }, [selectedUser]);

  const handleToggleTab = (tabId: string) => {
    setSelectedTabs(prev =>
      prev.includes(tabId)
        ? prev.filter(t => t !== tabId)
        : [...prev, tabId]
    );
  };

  const handleSave = () => {
    if (selectedUserId) {
      onUpdatePermissions(selectedUserId, selectedTabs);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Permission Management</CardTitle>
        <CardDescription>
          Select a user and assign access to specific dashboard tabs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Select User</Label>
          <Popover open={openUserCombobox} onOpenChange={setOpenUserCombobox}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openUserCombobox}
                className="w-full justify-between">
                {selectedUser
                  ? `${selectedUser.name} (${formatMobileNumber(selectedUser.mobile || "") || selectedUser.email})`
                  : "Search and select user..."}
                <ChevronsUpDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search user..." />
                <CommandList>
                  <CommandEmpty>No user found.</CommandEmpty>
                  <CommandGroup>
                    {users.map((user) => (
                      <CommandItem
                        key={user.id}
                        value={`${user.name} ${user.mobile} ${user.email} ${user.id}`.toLowerCase()}
                        onSelect={() => {
                          setSelectedUserId(user.id);
                          setOpenUserCombobox(false);
                        }}>
                        <CheckIcon
                          className={`mr-2 h-4 w-4 ${selectedUserId === user.id ? "opacity-100" : "opacity-0"
                            }`}
                        />
                        <div className="flex flex-col">
                          <span className="font-medium">{user.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {user.role} - {formatMobileNumber(user.mobile || "") || user.email || "N/A"}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {selectedUser && (
          <div className="space-y-4">
            <Label>Allowed Tabs</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border p-4 rounded-md dark:border-border/50">
              {availableTabs.map((tab) => (
                <div key={tab.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={tab.id}
                    checked={selectedTabs.includes(tab.id)}
                    onCheckedChange={() => handleToggleTab(tab.id)}
                  />
                  <Label htmlFor={tab.id} className="cursor-pointer">{tab.label}</Label>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Permissions"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};


const AdminDashboard: React.FC<{ user: User }> = ({ user }) => {
  // Set initial tab based on role
  const [activeTab, setActiveTab] = useState(() => {
    const isAdmin = user.role === Role.ADMIN;
    return isAdmin ? "analytics" : "dashboard";
  });

  const isAdmin = user.role === Role.ADMIN;
  const hasAccess = (tab: string) => isAdmin || user.allowedTabs?.includes(tab);



  const {
    data: allLeaves,
    isLoading: areLeavesLoading,
    isError: isLeavesError,
  } = useAllLeaves();
  const {
    data: config,
    isLoading: isConfigLoading,
    isError: isConfigError,
  } = useConfig();
  const {
    data: users,
    isLoading: areUsersLoading,
    isError: isUsersError,
  } = useAllUsers();

  const updateStatusMutation = useUpdateLeaveStatusMutation();
  const updateMultipleStatusesMutation =
    useUpdateMultipleLeaveStatusesMutation();
  const updateConfigMutation = useUpdateConfigMutation();
  const createLeaveMutation = useCreateLeaveMutation();
  const updateUserMutation = useUpdateUserMutation();

  const handleStatusChange = (
    leaveId: string,
    status: LeaveStatus.APPROVED | LeaveStatus.REJECTED,
    reason?: string
  ) => {
    const mutationData: any = { leaveId, status };
    if (reason) {
      mutationData.reason = reason;
    }

    toast
      .promise(updateStatusMutation.mutateAsync(mutationData), {
        loading: "Updating status...",
        success: () => `Leave has been ${status.toLowerCase()}.`,
        error: (error: any) =>
          error.response?.data?.message || "Failed to update leave status.",
      })
      .catch(() => { });
  };

  const handleBulkStatusChange = (variables: {
    leaveIds: string[];
    status: LeaveStatus.APPROVED | LeaveStatus.REJECTED;
  }) => {
    toast
      .promise(
        updateMultipleStatusesMutation.mutateAsync(variables) as Promise<
          Leave[]
        >,
        {
          loading: "Updating selected leaves...",
          success: (updatedData: Leave[]) =>
            `${updatedData.length
            } leave(s) have been ${variables.status.toLowerCase()}.`,
          error: (error: any) =>
            error.response?.data?.message || "Failed to update leave statuses.",
        }
      )
      .catch(() => { });
  };

  const handleConfigSave = (newConfig: Config) => {
    toast
      .promise(updateConfigMutation.mutateAsync(newConfig), {
        loading: "Saving settings...",
        success: "Configuration saved successfully!",
        error: (error: any) =>
          error.response?.data?.message || "Failed to save configuration.",
      })
      .catch(() => { });
  };

  const handleCreateLeave = (data: { userId: string; date: string; shiftId: string; status?: LeaveStatus; creatorId?: string }) => {
    const finalData = {
      ...data,
      creatorId: user.id, // Set the current admin as the creator
    };

    toast
      .promise(createLeaveMutation.mutateAsync(finalData), {
        loading: "Creating leave...",
        success: "Leave created successfully!",
        error: (error: any) =>
          error.response?.data?.message || "Failed to create leave.",
      })
      .catch(() => { });
  };


  const handleUpdatePermissions = (userId: string, allowedTabs: string[]) => {
    toast
      .promise(updateUserMutation.mutateAsync({ userId, allowedTabs }), {
        loading: "Updating user permissions...",
        success: "User permissions updated successfully!",
        error: (error: any) =>
          error.response?.data?.message || "Failed to update user permissions.",
      })
      .catch(() => { });
  };

  if (areLeavesLoading || isConfigLoading || areUsersLoading) {
    return (
      <div className="w-full mx-auto p-2 sm:p-8">
        <div className="grid grid-cols-6 gap-1 bg-muted p-1 rounded-md mb-2">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLeavesError || isConfigError || isUsersError || !allLeaves || !config || !users) {
    return (
      <div className="flex justify-center items-center h-screen text-red-500">
        Failed to load admin data. Please try again later.
      </div>
    );
  }

  const isActionLoading =
    updateStatusMutation.isPending ||
    updateConfigMutation.isPending ||
    updateMultipleStatusesMutation.isPending ||
    createLeaveMutation.isPending;

  return (
    <div className="w-full mx-auto p-2 sm:p-8 space-y-4 sm:space-y-8">
      <Tabs className="w-full">
        <div className="overflow-x-auto scrollbar-hide -mx-2 px-2 pb-2">
          <TabsList className="inline-flex w-max sm:w-full justify-start sm:justify-center gap-1">
            <TabsTrigger
              onClick={() => setActiveTab("dashboard")}
              active={activeTab === "dashboard"}
            >
              <HomeIcon className="w-4 h-4 mr-2" /> My Dashboard
            </TabsTrigger>
            {hasAccess("management") && (
              <TabsTrigger
                onClick={() => setActiveTab("management")}
                active={activeTab === "management"}>
                <ListIcon className="w-4 h-4 mr-2" /> Leaves
              </TabsTrigger>
            )}
            {hasAccess("create") && (
              <TabsTrigger
                onClick={() => setActiveTab("create")}
                active={activeTab === "create"}>
                <ListIcon className="w-4 h-4 mr-2" /> Create
              </TabsTrigger>
            )}
            {hasAccess("users") && (
              <TabsTrigger
                onClick={() => setActiveTab("users")}
                active={activeTab === "users"}>
                <UsersIcon className="w-4 h-4 mr-2" /> Users
              </TabsTrigger>
            )}
            {hasAccess("reports") && (
              <TabsTrigger
                onClick={() => setActiveTab("reports")}
                active={activeTab === "reports"}>
                <DownloadIcon className="w-4 h-4 mr-2" /> Reports
              </TabsTrigger>
            )}
            {hasAccess("settings") && (
              <TabsTrigger
                onClick={() => setActiveTab("settings")}
                active={activeTab === "settings"}>
                <SettingsIcon className="w-4 h-4 mr-2" /> Settings
              </TabsTrigger>
            )}
            {hasAccess("roles") && (
              <TabsTrigger
                onClick={() => setActiveTab("roles")}
                active={activeTab === "roles"}>
                <KeyIcon className="w-4 h-4 mr-2" /> Permissions
              </TabsTrigger>
            )}
            {hasAccess("shifts") && (
              <TabsTrigger
                onClick={() => setActiveTab("shifts")}
                active={activeTab === "shifts"}>
                <ListIcon className="w-4 h-4 mr-2" /> Shifts
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        <div className={activeTab === "dashboard" ? "w-full" : "max-w-6xl mx-auto w-full px-2 sm:px-4"}>
          {activeTab === "dashboard" && (
            <TabsContent>
              <UserDashboard user={user} />
            </TabsContent>
          )}

          {hasAccess("management") && activeTab === "management" && (
            <TabsContent>
              <LeaveManagement
                leaves={allLeaves}
                onStatusChange={handleStatusChange}
                onBulkStatusChange={handleBulkStatusChange}
                isActionLoading={isActionLoading}
              />
            </TabsContent>
          )}


          {hasAccess("roles") && activeTab === "roles" && (
            <TabsContent>
              <PermissionManagement
                users={users}
                onUpdatePermissions={handleUpdatePermissions}
                isLoading={updateUserMutation.isPending}
              />
            </TabsContent>
          )}

          {hasAccess("create") && activeTab === "create" && (
            <TabsContent>
              <CreateLeave
                users={users}
                config={config}
                onCreate={handleCreateLeave}
                isLoading={isActionLoading}
              />
            </TabsContent>
          )}
          {hasAccess("users") && activeTab === "users" && (
            <TabsContent>
              <UserManagement />
            </TabsContent>
          )}
          {hasAccess("reports") && activeTab === "reports" && (
            <TabsContent>
              <Reports leaves={allLeaves} />
            </TabsContent>
          )}
          {hasAccess("settings") && activeTab === "settings" && (
            <TabsContent>
              <Settings
                config={config}
                onSave={handleConfigSave}
                isLoading={isActionLoading}
              />
            </TabsContent>
          )}
          {hasAccess("shifts") && activeTab === "shifts" && (
            <TabsContent>
              <ShiftManagement users={users || []} shifts={config.shifts} />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div >
  );
};

export default AdminDashboard;

export const formatMobileNumber = (number: string): string => {
  const digits = number.replace(/\D/g, "");
  if (!digits.startsWith("91")) return number;
  const countryCode = digits.slice(0, 2);
  const first = digits.slice(2, 6);
  const second = digits.slice(6, 9);
  const third = digits.slice(9);
  return `+${countryCode} ${first} ${second} ${third}`.trim();
};