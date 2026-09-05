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
    { key: 'employeeId', header: 'Emp ID', width: '90px' },
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
                <div className="flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(row.id);
                    }}
                    className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-medium bg-emerald-50 text-[var(--accent)] rounded hover:bg-emerald-100"
                  >
                    <Check size={11} /> Approve
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReject(row.id);
                    }}
                    className="inline-flex items-center gap-1 px-2 h-6 text-[11px] font-medium bg-red-50 text-[var(--danger)] rounded hover:bg-red-100"
                  >
                    <X size={11} /> Reject
                  </button>
                </div>
              ) : (
                <span className="text-xs text-[var(--slate)]">—</span>
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[var(--ink)]">Leaves</h1>
        <Can module="leave" action="write">
          <button className="inline-flex items-center gap-1.5 px-3 h-8 bg-[var(--accent)] text-white text-sm font-medium rounded hover:opacity-90 transition-opacity">
            <Plus size={14} />
            Apply Leave
          </button>
        </Can>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--line)]">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.value
                ? 'text-[var(--accent)] border-b-[var(--accent)]'
                : 'text-[var(--slate)] border-b-transparent hover:text-[var(--ink)]'
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs tabular-nums">
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
