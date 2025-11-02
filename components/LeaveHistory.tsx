
import React from 'react';
import { toast } from 'react-hot-toast';
import { User, Leave, LeaveStatus } from '../types';
import { useUserLeaves, useCancelLeaveMutation } from '../hooks/useLeaves';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui';
import { CalendarIcon, ChevronLeftIcon } from './icons';
import LeaveItem from './LeaveItem';

const Skeleton = ({ className }: { className?: string }) => (
    <div className={`animate-pulse rounded-md bg-muted ${className}`} />
);

const LeaveHistory: React.FC<{ user: User }> = ({ user }) => {
    const { data: leaves, isLoading, isError } = useUserLeaves(user.id);
    const cancelLeaveMutation = useCancelLeaveMutation();

    const sortedLeaves = React.useMemo(() => 
        leaves ? [...leaves].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [],
    [leaves]);
    
    const handleBack = () => {
        window.location.hash = '#/';
    };
    
    const handleCancelLeave = (leaveId: string) => {
        toast.promise(
            cancelLeaveMutation.mutateAsync(leaveId),
            {
                loading: 'Cancelling request...',
                success: 'Leave request cancelled successfully!',
                error: (error: any) => error.response?.data?.message || 'Failed to cancel leave request.',
            }
        ).catch(() => {});
    };

    if (isLoading) {
        return (
             <div className="container mx-auto p-4 md:p-8">
                <Skeleton className="h-10 w-48 mb-4" />
                <Card>
                    <CardHeader>
                        <Skeleton className="h-8 w-1/2" />
                        <Skeleton className="h-4 w-3/4" />
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="space-y-2 p-4">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isError) {
        return <div className="flex justify-center items-center h-screen text-red-500">Failed to load leave history.</div>;
    }

    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="mb-4">
                <Button variant="ghost" onClick={handleBack} aria-label="Back to Dashboard">
                    <ChevronLeftIcon className="w-4 h-4 mr-2" />
                    Back to Dashboard
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Full Leave History</CardTitle>
                    <CardDescription>A complete record of all your leave requests.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {sortedLeaves.length > 0 ? (
                        <div className="max-h-[70vh] overflow-y-auto">
                           {sortedLeaves.map(leave => <LeaveItem key={leave.id} leave={leave} onCancel={handleCancelLeave} isActionLoading={cancelLeaveMutation.isPending} />)}
                        </div>
                    ) : (
                        <div className="p-6 text-center text-muted-foreground">
                            <CalendarIcon className="mx-auto h-12 w-12" />
                            <p className="mt-4">You have no leave history.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default LeaveHistory;
