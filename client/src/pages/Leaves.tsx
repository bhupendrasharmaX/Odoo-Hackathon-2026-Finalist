import { useEffect, useState } from 'react';
import { Plus, Check, X } from 'lucide-react';
import api from '../api';
import type { LeaveRequest, LeaveStatus } from '../types';
import { DataTable, type Column } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Can, useCan } from '../components/Can';
import { useToast } from '../components/Toast';

const TABS: { label: string; value: LeaveStatus | 'all' }[] = [
  { label: 'All',      value: 'all' },
  { label: 'Pending',  value: 'pending' },
  { label: 'Approved', value: 'approved' },
  { label: 'Rejected', value: 'rejected' },
];

export function LeavesPage() {
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<LeaveStatus | 'all'>('all');
  const { addToast } = useToast();
  const { allowed: canApprove } = useCan('leave', 'approve');

  useEffect(() => {
    api
      .getLeaveRequests()
      .then(setLeaves)
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await api.approveLeave(id);
      setLeaves((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: 'approved' } : l))
      );
      addToast('success', 'Leave approved');
    } catch (err: any) {
      addToast('error', 'Failed', err.message);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.rejectLeave(id);
      setLeaves((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: 'rejected' } : l))
      );
      addToast('warning', 'Leave rejected');
    } catch (err: any) {
      addToast('error', 'Failed', err.message);
    }
  };

  const filtered =
    activeTab === 'all'
      ? leaves
      : leaves.filter((l) => l.status === activeTab);

  const columns: Column<LeaveRequest>[] = [
    { key: 'employeeId', header: 'Emp ID', width: '110px' },
    { key: 'employeeName', header: 'Name' },
    {
      key: 'leaveType',
      header: 'Type',
      render: (row) => <StatusBadge status={row.leaveType} />,
    },
    {
      key: 'startDate',
      header: 'From',
      render: (row) =>
        new Date(row.startDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
        }),
    },
    {
      key: 'endDate',
      header: 'To',
      render: (row) =>
        new Date(row.endDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
        }),
    },
    {
      key: 'days',
      header: 'Days',
      align: 'right',
      render: (row) => <span className="tabular-nums">{row.days}</span>,
    },
    { key: 'reason', header: 'Reason' },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    ...(canApprove
      ? [
          {
            key: 'actions' as string,
            header: 'Actions',
            sortable: false,
            render: (row: LeaveRequest) =>
              row.status === 'pending' ? (
                <div className="flex gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(row.id);
                    }}
                    className="btn btn-xs btn-success-tonal"
                  >
                    <Check size={12} /> Approve
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReject(row.id);
                    }}
                    className="btn btn-xs btn-danger-tonal"
                  >
                    <X size={12} /> Reject
                  </button>
                </div>
              ) : (
                <span className="text-xs text-[var(--muted)]">—</span>
              ),
          } as Column<LeaveRequest>,
        ]
      : []),
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-[var(--slate)]">
        Loading leaves…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Leaves</h1>
          <p className="page-subtitle">
            Requests waiting on you, and everything already decided.
          </p>
        </div>
        <Can module="leave" action="write">
          <button className="btn btn-primary">
            <Plus size={16} />
            Apply Leave
          </button>
        </Can>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`tab-pill ${
              activeTab === tab.value ? 'tab-pill-active' : ''
            }`}
          >
            {tab.label}
            <span className="tab-count">
              {tab.value === 'all'
                ? leaves.length
                : leaves.filter((l) => l.status === tab.value).length}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <DataTable<LeaveRequest>
        columns={columns}
        data={filtered}
        rowKey={(row) => row.id}
        searchFields={['employeeName', 'employeeId', 'reason']}
        pageSize={15}
      />
    </div>
  );
}
