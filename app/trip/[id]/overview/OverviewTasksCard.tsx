'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getAvatarEmoji } from '@/lib/constants/avatars';

interface TaskItem {
  _id: string;
  type: string;
  title: string;
  quantity?: number;
  createdBy?: {
    _id: string;
    username: string;
    avatarId?: string;
  };
}

interface OverviewTasksCardProps {
  tripId: string;
  myTasks: TaskItem[];
  openTasks: TaskItem[];
}

export default function OverviewTasksCard({
  tripId,
  myTasks,
  openTasks,
}: OverviewTasksCardProps) {
  const [activeTab, setActiveTab] = useState<'my' | 'open'>(
    myTasks.length > 0 ? 'my' : 'open'
  );

  if (myTasks.length === 0 && openTasks.length === 0) {
    return null;
  }

  const currentList = activeTab === 'my' ? myTasks : openTasks;

  return (
    <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-5 mb-3 sm:mb-4 bg-white shadow-xs">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pb-2.5 border-b border-black/[0.04]">
        <div className="flex items-center gap-2">
          <span className="text-base sm:text-lg">🎯</span>
          <h2
            className="text-sm sm:text-base font-semibold"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-charcoal)' }}
          >
            Trip tasks & gear
          </h2>
        </div>

        {/* Segmented Switch */}
        <div className="flex bg-[#f1f4f1] p-1 rounded-xl text-xs font-medium self-start sm:self-auto select-none touch-manipulation">
          <button
            type="button"
            onClick={() => setActiveTab('my')}
            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer select-none touch-manipulation ${
              activeTab === 'my'
                ? 'bg-white text-gray-900 shadow-xs font-semibold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>My tasks</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === 'my' ? 'bg-[#ccead5] text-[#183124]' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {myTasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('open')}
            className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer select-none touch-manipulation ${
              activeTab === 'open'
                ? 'bg-white text-gray-900 shadow-xs font-semibold'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>Open tasks</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === 'open' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {openTasks.length}
            </span>
          </button>
        </div>
      </div>

      {/* Task List */}
      {currentList.length === 0 ? (
        <div className="py-6 text-center text-xs text-gray-400">
          {activeTab === 'my'
            ? 'No tasks claimed by you yet. Check Open tasks to volunteer!'
            : 'All tasks and gear items are currently claimed!'}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-black/[0.04]">
          {currentList.map((item) => (
            <div
              key={item._id}
              className="py-2.5 flex items-center justify-between first:pt-0 last:pb-0 gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs shrink-0">{item.type === 'errand' ? '📋' : '🎒'}</span>
                  {item.type === 'gear' && (item.quantity || 1) > 1 && (
                    <span
                      className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md bg-[#eef3ef] text-[#2d523a] border border-[#cde0d2] shrink-0 leading-none select-none"
                      title={`${item.quantity} items needed`}
                    >
                      {item.quantity}x
                    </span>
                  )}
                  <span className="text-xs sm:text-sm font-medium text-gray-800 truncate">
                    {item.title}
                  </span>
                </div>
                {item.createdBy && (
                  <p className="text-[0.6875rem] text-gray-400 mt-0.5">
                    Added by {getAvatarEmoji(item.createdBy.avatarId)} {item.createdBy.username}
                  </p>
                )}
              </div>

              <Link
                href={`/trip/${tripId}/tasks`}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors shrink-0 select-none touch-manipulation ${
                  activeTab === 'my'
                    ? 'bg-[#eef1ee] text-[#4a6454] hover:bg-[#e0e3e0]'
                    : 'bg-[#ccead5] text-[#183124] hover:bg-[#b0cdba]'
                }`}
              >
                {activeTab === 'my' ? (
                  <>
                    <span className="sm:hidden">Tasks →</span>
                    <span className="hidden sm:inline">Complete in Tasks →</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">Claim</span>
                    <span className="hidden sm:inline">Volunteer / Claim</span>
                  </>
                )}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
