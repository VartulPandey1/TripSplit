'use client';

import { useState } from 'react';
import { getAvatarEmoji } from '@/lib/constants/avatars';

interface TaskUser {
  _id: string;
  username: string;
  avatarId?: string;
}

interface TaskItem {
  _id: string;
  type: 'errand' | 'gear';
  title: string;
  quantity?: number;
  assignedTo?: TaskUser | null;
  createdBy?: TaskUser | null;
  isCompleted: boolean;
}

interface Member {
  _id: string;
  username: string;
  avatarId?: string;
}

interface TasksClientProps {
  tripId: string;
  currentUserId: string;
  members: Member[];
  initialTasks: TaskItem[];
  isTripCompleted?: boolean;
}

export default function TasksClient({
  tripId,
  currentUserId,
  members,
  initialTasks,
  isTripCompleted = false,
}: TasksClientProps) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [newGearTitle, setNewGearTitle] = useState('');
  const [newGearQuantity, setNewGearQuantity] = useState(1);
  const [newErrandTitle, setNewErrandTitle] = useState('');
  const [loadingType, setLoadingType] = useState<'gear' | 'errand' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const memberMap = new Map<string, Member>();
  (members || []).forEach((m) => memberMap.set(m._id, m));

  function getTaskCreator(task: TaskItem) {
    if (task.createdBy && typeof task.createdBy === 'object' && task.createdBy.username) {
      return {
        _id: task.createdBy._id,
        name: task.createdBy._id === currentUserId ? 'You' : task.createdBy.username,
        avatarId: task.createdBy.avatarId,
        isMe: task.createdBy._id === currentUserId,
      };
    }
    const creatorId = typeof task.createdBy === 'string' ? task.createdBy : task.createdBy?._id;
    if (creatorId) {
      const found = memberMap.get(creatorId);
      if (found) {
        return {
          _id: found._id,
          name: found._id === currentUserId ? 'You' : found.username,
          avatarId: found.avatarId,
          isMe: found._id === currentUserId,
        };
      }
      if (creatorId === currentUserId) {
        return { _id: currentUserId, name: 'You', avatarId: undefined, isMe: true };
      }
    }
    return null;
  }

  function getAssignedUser(task: TaskItem) {
    if (task.assignedTo && typeof task.assignedTo === 'object' && task.assignedTo.username) {
      return {
        _id: task.assignedTo._id,
        username: task.assignedTo.username,
        avatarId: task.assignedTo.avatarId,
      };
    }
    const assignedId = typeof task.assignedTo === 'string' ? task.assignedTo : task.assignedTo?._id;
    if (assignedId) {
      const found = memberMap.get(assignedId);
      if (found) {
        return found;
      }
    }
    return null;
  }

  const gearItems = tasks.filter((t) => t.type === 'gear');
  const errands = tasks.filter((t) => t.type === 'errand');

  const packedGearCount = gearItems.filter((t) => t.isCompleted).length;
  const completedErrandsCount = errands.filter((t) => t.isCompleted).length;

  async function handleAddTask(type: 'gear' | 'errand', e: React.FormEvent) {
    e.preventDefault();
    if (isTripCompleted) {
      setErrorMessage('This trip is marked completed. Checklists are archived and read-only.');
      return;
    }
    const title = type === 'gear' ? newGearTitle.trim() : newErrandTitle.trim();
    if (!title) {
      setErrorMessage('Please enter an item title (cannot be blank or only spaces).');
      return;
    }

    setLoadingType(type);
    setErrorMessage('');

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          type,
          title,
          quantity: type === 'gear' ? Math.max(1, newGearQuantity) : 1,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        const currentUserMember = members?.find((m) => m._id === currentUserId);
        const resolvedCreator =
          created.createdBy && typeof created.createdBy === 'object' && created.createdBy.username
            ? created.createdBy
            : currentUserMember || {
                _id: currentUserId,
                username: 'You',
                avatarId: undefined,
              };

        const taskWithCreator = {
          ...created,
          createdBy: resolvedCreator,
        };
        setTasks([taskWithCreator, ...tasks]);
        if (type === 'gear') {
          setNewGearTitle('');
          setNewGearQuantity(1);
        } else {
          setNewErrandTitle('');
        }
      } else {
        const data = await res.json();
        setErrorMessage(data.error || 'Failed to add item');
      }
    } catch {
      setErrorMessage('Network error');
    } finally {
      setLoadingType(null);
    }
  }

  async function handleUpdateQuantity(task: TaskItem, newQty: number) {
    if (isTripCompleted) return;
    if (newQty < 1) return;
    try {
      const res = await fetch(`/api/tasks/${task._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: newQty }),
      });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t._id === task._id ? { ...t, quantity: newQty } : t))
        );
      }
    } catch {
      // ignore
    }
  }

  async function toggleComplete(task: TaskItem) {
    if (isTripCompleted) {
      setErrorMessage('This trip is marked completed. Checklists are archived and read-only.');
      return;
    }
    setErrorMessage('');

    const assignedUser = getAssignedUser(task);
    const assignedId = assignedUser?._id || (typeof task.assignedTo === 'string' ? task.assignedTo : task.assignedTo?._id);
    const isAssignedToMe = assignedId === currentUserId;
    const isClaimed = Boolean(assignedUser || task.assignedTo);

    // If claimed by someone else, only that person can toggle completion
    if (isClaimed && !isAssignedToMe) {
      const assignedName = assignedUser?.username || 'the assigned member';
      setErrorMessage(`Only ${assignedName} can mark this ${task.type === 'gear' ? 'packed' : 'completed'}.`);
      return;
    }

    const newCompleted = !task.isCompleted;
    // If not claimed by anyone yet, clicking complete claims it for the user automatically
    const autoClaim = !isClaimed && newCompleted;
    const currentUserMember = members?.find((m) => m._id === currentUserId);

    // Optimistic update
    setTasks(
      tasks.map((t) =>
        t._id === task._id
          ? {
              ...t,
              isCompleted: newCompleted,
              assignedTo: autoClaim
                ? { _id: currentUserId, username: currentUserMember?.username || 'You', avatarId: currentUserMember?.avatarId }
                : t.assignedTo,
            }
          : t
      )
    );

    const payload: { isCompleted: boolean; assignedTo?: string } = { isCompleted: newCompleted };
    if (autoClaim) {
      payload.assignedTo = currentUserId;
    }

    const res = await fetch(`/api/tasks/${task._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json();
      setErrorMessage(data.error || 'Failed to update item');
      // Revert optimistic update
      setTasks(
        tasks.map((t) =>
          t._id === task._id
            ? { ...t, isCompleted: task.isCompleted, assignedTo: task.assignedTo }
            : t
        )
      );
    } else {
      const updated = await res.json();
      setTasks(tasks.map((t) => (t._id === task._id ? updated : t)));
    }
  }

  async function assignTask(taskId: string, targetUserId: string | null) {
    if (isTripCompleted) {
      setErrorMessage('This trip is marked completed. Checklists are archived and read-only.');
      return;
    }
    const targetTask = tasks.find((t) => t._id === taskId);
    if (targetTask?.isCompleted) {
      setErrorMessage('Completed or packed items cannot be released or reassigned. Uncheck the item first to re-open it.');
      return;
    }
    setErrorMessage('');
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedTo: targetUserId }),
    });

    if (res.ok) {
      const updated = await res.json();
      setTasks(tasks.map((t) => (t._id === taskId ? updated : t)));
    } else {
      const data = await res.json();
      setErrorMessage(data.error || 'Failed to update assignment');
    }
  }

  async function switchTaskType(task: TaskItem) {
    if (isTripCompleted) {
      setErrorMessage('This trip is marked completed. Checklists are archived and read-only.');
      return;
    }
    if (task.isCompleted) {
      setErrorMessage('Completed or packed items cannot be moved between checklists. Uncheck the item first to re-open it.');
      return;
    }
    setErrorMessage('');
    const targetType: 'errand' | 'gear' = task.type === 'gear' ? 'errand' : 'gear';

    // Optimistic switch
    setTasks(tasks.map((t) => (t._id === task._id ? { ...t, type: targetType } : t)));

    try {
      const res = await fetch(`/api/tasks/${task._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: targetType }),
      });

      if (!res.ok) {
        const data = await res.json();
        setErrorMessage(data.error || 'Failed to move item');
        // Revert
        setTasks(tasks.map((t) => (t._id === task._id ? { ...t, type: task.type } : t)));
      } else {
        const updated = await res.json();
        setTasks(tasks.map((t) => (t._id === task._id ? updated : t)));
      }
    } catch {
      setErrorMessage('Network error');
      setTasks(tasks.map((t) => (t._id === task._id ? { ...t, type: task.type } : t)));
    }
  }

  async function deleteTask(id: string) {
    if (isTripCompleted) {
      setErrorMessage('This trip is marked completed. Checklists are archived and read-only.');
      return;
    }
    setTasks(tasks.filter((t) => t._id !== id));
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  }

  return (
    <div className="px-3 py-3 sm:px-6 sm:py-6 max-w-4xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-xl sm:text-3xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: 'var(--color-charcoal)' }}
        >
          Group Coordination
        </h1>
        <p className="text-xs sm:text-sm text-gray-500">
          Shared packing gear and pre-trip tasks for everyone on the trip
        </p>
      </div>

      {/* Archived Trip Banner */}
      {isTripCompleted && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50 border border-amber-200/90 flex items-center gap-3 text-amber-900 shadow-2xs">
          <span className="text-xl">📁</span>
          <div className="text-xs sm:text-sm">
            <span className="font-semibold">Archived Checklists: </span>
            <span className="text-amber-800">
              This trip is completed. Checklists and packing gear are locked in read-only mode for historical record.
            </span>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-900 flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-1.5 font-medium">
            <span>⚠️</span> {errorMessage}
          </span>
          <button
            onClick={() => setErrorMessage('')}
            className="text-xs font-bold px-2 py-0.5 text-amber-700 hover:text-amber-950 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* CARD 1: Packing List & Gear (ON TOP) */}
      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-white border border-[#e4e5e0] shadow-2xs">
        {/* Card Header */}
        <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-[#f1f4f1]">
          <div className="flex items-center gap-2">
            <span className="text-lg sm:text-xl">🎒</span>
            <div>
              <h2
                className="text-sm sm:text-base font-semibold text-[#1a1e1c]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Packing List & Gear
              </h2>
              <p className="text-[10px] sm:text-xs text-gray-500">
                Shared equipment, supplies, and items members are bringing
              </p>
            </div>
          </div>
          <span className="text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-full bg-[#f1f4f1] text-[#1c4b32] border border-[#e4e5e0]">
            {packedGearCount}/{gearItems.length} packed
          </span>
        </div>

        {/* Inline Add Gear Form / Archived Notice */}
        {!isTripCompleted ? (
          <form onSubmit={(e) => handleAddTask('gear', e)} className="flex gap-2 mb-3.5">
            <input
              type="text"
              placeholder="e.g. Tent, First-aid kit, Portable speaker, Power bank…"
              value={newGearTitle}
              onChange={(e) => setNewGearTitle(e.target.value)}
              className="flex-1 rounded-xl px-3.5 py-2 sm:py-2.5 outline-none text-xs sm:text-sm bg-[#f7faf6] border border-[#e4e5e0] focus:border-[#3b7a5a] transition-all min-w-0"
            />
            <div
              className="flex items-center gap-1 bg-[#f7faf6] border border-[#e4e5e0] rounded-xl px-2 py-1 shrink-0"
              title="Quantity needed for trip"
            >
              <span className="text-[10px] text-gray-400 font-semibold uppercase">Qty:</span>
              <input
                type="number"
                min="1"
                max="99"
                value={newGearQuantity}
                onChange={(e) => setNewGearQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-8 text-xs sm:text-sm font-mono font-semibold text-center outline-none bg-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loadingType === 'gear' || !newGearTitle.trim()}
              className="text-white text-xs sm:text-sm font-semibold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50 shrink-0 bg-[#3b7a5a] hover:bg-[#326a4e]"
            >
              {loadingType === 'gear' ? 'Adding…' : '+ Add Gear'}
            </button>
          </form>
        ) : (
          <div className="mb-3.5 px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 flex items-center gap-2">
            <span>🔒</span>
            <span>Archived: Checklist is locked in read-only mode for completed trip.</span>
          </div>
        )}

        {/* Gear Items List */}
        {gearItems.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400">
            No packing gear added yet. Type an item above to add to the checklist!
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-[#f1f4f1]">
            {gearItems.map((task) => {
              const creator = getTaskCreator(task);
              const assignedUser = getAssignedUser(task);
              const isClaimedByMe = (assignedUser?._id || task.assignedTo?._id) === currentUserId;
              const isClaimed = Boolean(assignedUser || task.assignedTo);
              const canCheck = !isTripCompleted && (!isClaimed || isClaimedByMe);

              return (
                <div
                  key={task._id}
                  className="py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 group hover:bg-[#fafbfa] sm:px-2 rounded-xl transition-colors"
                >
                  {/* Left: Checkbox + Title + Mobile Delete */}
                  <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={task.isCompleted}
                      disabled={!canCheck}
                      onChange={() => toggleComplete(task)}
                      title={
                        isTripCompleted
                          ? 'Trip is completed — checklist is locked in archive mode'
                          : isClaimed && !isClaimedByMe
                          ? `Claimed by ${assignedUser?.username || 'another member'}`
                          : 'Mark packed'
                      }
                      className={`w-4 h-4 rounded-md accent-[#3b7a5a] mt-0.5 sm:mt-0 shrink-0 ${
                        !canCheck ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p
                          className={`text-xs sm:text-sm font-medium break-words ${
                            task.isCompleted ? 'line-through text-gray-400' : 'text-[#1a1e1c]'
                          }`}
                        >
                          {task.title}
                        </p>

                        {/* Quantity Counter Badge with Increment / Decrement */}
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#eef4f0] text-[#244b34] border border-[#d3e2d7] shrink-0"
                          title="Count required"
                        >
                          <span>Qty: {task.quantity || 1}</span>
                          {!isTripCompleted && (
                            <span className="inline-flex items-center gap-0.5 ml-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateQuantity(task, (task.quantity || 1) + 1);
                                }}
                                className="w-3.5 h-3.5 rounded flex items-center justify-center hover:bg-[#c6dbcd] text-[10px] cursor-pointer"
                                title="Add 1"
                              >
                                +
                              </button>
                              {(task.quantity || 1) > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateQuantity(task, (task.quantity || 1) - 1);
                                  }}
                                  className="w-3.5 h-3.5 rounded flex items-center justify-center hover:bg-[#c6dbcd] text-[10px] cursor-pointer"
                                  title="Reduce 1"
                                >
                                  -
                                </button>
                              )}
                            </span>
                          )}
                        </span>

                        {task.isCompleted && (
                          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200 shrink-0">
                            🎒 Packed
                          </span>
                        )}
                      </div>

                      {/* Mobile metadata row (clean wrapping, no overflow) */}
                      <div className="flex items-center gap-1.5 text-xs mt-1.5 flex-wrap sm:hidden">
                        {creator && (
                          <span className="text-[10px] text-gray-500 inline-flex items-center gap-1 bg-white border border-gray-200 px-1.5 py-0.5 rounded-md shadow-3xs">
                            <span className="text-gray-400">By:</span>
                            <span className="font-semibold text-gray-700 inline-flex items-center gap-0.5">
                              {getAvatarEmoji(creator.avatarId)} {creator.name}
                            </span>
                          </span>
                        )}

                        {assignedUser ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border shadow-3xs"
                            style={{
                              backgroundColor: isClaimedByMe ? '#eaf3ec' : '#f1f4f1',
                              borderColor: isClaimedByMe ? '#ccead5' : '#e4e5e0',
                              color: isClaimedByMe ? '#1a4427' : '#183124',
                            }}
                          >
                            <span className="text-gray-500 font-normal">Claimed:</span>
                            <span className="font-bold inline-flex items-center gap-0.5">
                              {getAvatarEmoji(assignedUser.avatarId)} {isClaimedByMe ? 'You' : assignedUser.username}
                            </span>
                            {isClaimedByMe && !isTripCompleted && !task.isCompleted && (
                              <button
                                type="button"
                                onClick={() => assignTask(task._id, null)}
                                className="ml-1 text-[9px] text-gray-400 hover:text-red-500 cursor-pointer font-normal underline"
                                title="Release"
                              >
                                release
                              </button>
                            )}
                          </span>
                        ) : !isTripCompleted && !task.isCompleted ? (
                          <button
                            type="button"
                            onClick={() => assignTask(task._id, currentUserId)}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#e3efe7] hover:bg-[#d0e5d6] text-[#1a4427] border border-[#c2decc] cursor-pointer inline-flex items-center gap-1 shadow-3xs transition-colors"
                          >
                            <span>🙋 Claim</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400">Unclaimed</span>
                        )}

                        {!isTripCompleted && !task.isCompleted && (
                          <button
                            type="button"
                            onClick={() => switchTaskType(task)}
                            className="text-[10px] text-gray-400 hover:text-[#4a6454] cursor-pointer hover:underline"
                            title="Move to Pre-Trip Errands"
                          >
                            ⇄ Move
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mobile Delete */}
                    {!isTripCompleted && (
                      <button
                        onClick={() => deleteTask(task._id)}
                        className="text-xs text-gray-300 hover:text-red-500 p-1 cursor-pointer transition-colors sm:hidden shrink-0"
                        title="Delete item"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Desktop Right Side: Spacious & Uncluttered */}
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {creator && (
                      <span className="text-[11px] text-gray-500 inline-flex items-center gap-1 bg-white border border-gray-200 px-2 py-0.5 rounded-md shadow-3xs">
                        <span className="text-gray-400">By:</span>
                        <span className="font-semibold text-gray-700 inline-flex items-center gap-1">
                          {getAvatarEmoji(creator.avatarId)} {creator.name}
                        </span>
                      </span>
                    )}

                    {assignedUser ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border shadow-3xs"
                        style={{
                          backgroundColor: isClaimedByMe ? '#eaf3ec' : '#f1f4f1',
                          borderColor: isClaimedByMe ? '#ccead5' : '#e4e5e0',
                          color: isClaimedByMe ? '#1a4427' : '#183124',
                        }}
                      >
                        <span className="text-gray-500 font-normal">Claimed:</span>
                        <span className="font-bold inline-flex items-center gap-1">
                          {getAvatarEmoji(assignedUser.avatarId)} {isClaimedByMe ? 'You' : assignedUser.username}
                        </span>
                        {isClaimedByMe && !isTripCompleted && !task.isCompleted && (
                          <button
                            type="button"
                            onClick={() => assignTask(task._id, null)}
                            className="ml-1 text-[10px] text-gray-400 hover:text-red-500 cursor-pointer font-normal underline"
                            title="Release"
                          >
                            release
                          </button>
                        )}
                      </span>
                    ) : !isTripCompleted && !task.isCompleted ? (
                      <button
                        type="button"
                        onClick={() => assignTask(task._id, currentUserId)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#e3efe7] hover:bg-[#d0e5d6] text-[#1a4427] border border-[#c2decc] cursor-pointer inline-flex items-center gap-1 shadow-3xs transition-colors"
                      >
                        <span>🙋 Claim</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-400">Unclaimed</span>
                    )}

                    {!isTripCompleted && (
                      <>
                        {!task.isCompleted && (
                          <button
                            type="button"
                            onClick={() => switchTaskType(task)}
                            className="text-xs text-gray-400 hover:text-[#4a6454] cursor-pointer hover:underline px-1"
                            title="Move to Pre-Trip Errands"
                          >
                            ⇄ Move
                          </button>
                        )}

                        <button
                          onClick={() => deleteTask(task._id)}
                          className="text-xs text-gray-300 hover:text-red-500 p-1 cursor-pointer transition-colors"
                          title="Delete item"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CARD 2: Pre-Trip Errands (BELOW) */}
      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-white border border-[#e4e5e0] shadow-2xs">
        {/* Card Header */}
        <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-[#f1f4f1]">
          <div className="flex items-center gap-2">
            <span className="text-lg sm:text-xl">📋</span>
            <div>
              <h2
                className="text-sm sm:text-base font-semibold text-[#1a1e1c]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                Pre-Trip Errands
              </h2>
              <p className="text-[10px] sm:text-xs text-gray-500">
                Bookings, reservations, and to-dos to handle before departure
              </p>
            </div>
          </div>
          <span className="text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-full bg-[#f1f4f1] text-[#2d4a36] border border-[#e4e5e0]">
            {completedErrandsCount}/{errands.length} done
          </span>
        </div>

        {/* Inline Add Errand Form / Archived Notice */}
        {!isTripCompleted ? (
          <form onSubmit={(e) => handleAddTask('errand', e)} className="flex gap-2 mb-3.5">
            <input
              type="text"
              placeholder="e.g. Book rental car, Buy snacks, Exchange currency…"
              value={newErrandTitle}
              onChange={(e) => setNewErrandTitle(e.target.value)}
              className="flex-1 rounded-xl px-3.5 py-2 sm:py-2.5 outline-none text-xs sm:text-sm bg-[#f7faf6] border border-[#e4e5e0] focus:border-[#4a6454] transition-all min-w-0"
            />
            <button
              type="submit"
              disabled={loadingType === 'errand' || !newErrandTitle.trim()}
              className="text-white text-xs sm:text-sm font-semibold px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50 shrink-0 bg-[#4a6454] hover:bg-[#3d5345]"
            >
              {loadingType === 'errand' ? 'Adding…' : '+ Add Errand'}
            </button>
          </form>
        ) : (
          <div className="mb-3.5 px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 flex items-center gap-2">
            <span>🔒</span>
            <span>Archived: Checklist is locked in read-only mode for completed trip.</span>
          </div>
        )}

        {/* Errands Items List */}
        {errands.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400">
            No errands added yet. Type a task above to add to the checklist!
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-[#f1f4f1]">
            {errands.map((task) => {
              const creator = getTaskCreator(task);
              const assignedUser = getAssignedUser(task);
              const isClaimedByMe = (assignedUser?._id || task.assignedTo?._id) === currentUserId;
              const isClaimed = Boolean(assignedUser || task.assignedTo);
              const canCheck = !isTripCompleted && (!isClaimed || isClaimedByMe);

              return (
                <div
                  key={task._id}
                  className="py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-4 group hover:bg-[#fafbfa] sm:px-2 rounded-xl transition-colors"
                >
                  {/* Left: Checkbox + Title + Mobile Delete */}
                  <div className="flex items-start sm:items-center gap-2.5 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={task.isCompleted}
                      disabled={!canCheck}
                      onChange={() => toggleComplete(task)}
                      title={
                        isTripCompleted
                          ? 'Trip is completed — checklist is locked in archive mode'
                          : isClaimed && !isClaimedByMe
                          ? `Assigned to ${assignedUser?.username || 'another member'}`
                          : 'Mark completed'
                      }
                      className={`w-4 h-4 rounded-md accent-[#4a6454] mt-0.5 sm:mt-0 shrink-0 ${
                        !canCheck ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p
                          className={`text-xs sm:text-sm font-medium break-words ${
                            task.isCompleted ? 'line-through text-gray-400' : 'text-[#1a1e1c]'
                          }`}
                        >
                          {task.title}
                        </p>
                        {task.isCompleted && (
                          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-1.5 py-0.2 rounded-full border border-emerald-200 shrink-0">
                            ✓ Done
                          </span>
                        )}
                      </div>

                      {/* Mobile metadata row (clean wrapping, no overflow) */}
                      <div className="flex items-center gap-1.5 text-xs mt-1.5 flex-wrap sm:hidden">
                        {creator && (
                          <span className="text-[10px] text-gray-500 inline-flex items-center gap-1 bg-white border border-gray-200 px-1.5 py-0.5 rounded-md shadow-3xs">
                            <span className="text-gray-400">By:</span>
                            <span className="font-semibold text-gray-700 inline-flex items-center gap-0.5">
                              {getAvatarEmoji(creator.avatarId)} {creator.name}
                            </span>
                          </span>
                        )}

                        {assignedUser ? (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border shadow-3xs"
                            style={{
                              backgroundColor: isClaimedByMe ? '#eaf3ec' : '#f1f4f1',
                              borderColor: isClaimedByMe ? '#ccead5' : '#e4e5e0',
                              color: isClaimedByMe ? '#1a4427' : '#183124',
                            }}
                          >
                            <span className="text-gray-500 font-normal">Assigned:</span>
                            <span className="font-bold inline-flex items-center gap-0.5">
                              {getAvatarEmoji(assignedUser.avatarId)} {isClaimedByMe ? 'You' : assignedUser.username}
                            </span>
                            {isClaimedByMe && !isTripCompleted && !task.isCompleted && (
                              <button
                                type="button"
                                onClick={() => assignTask(task._id, null)}
                                className="ml-1 text-[9px] text-gray-400 hover:text-red-500 cursor-pointer font-normal underline"
                                title="Release"
                              >
                                release
                              </button>
                            )}
                          </span>
                        ) : !isTripCompleted && !task.isCompleted ? (
                          <button
                            type="button"
                            onClick={() => assignTask(task._id, currentUserId)}
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-[#e3efe7] hover:bg-[#d0e5d6] text-[#1a4427] border border-[#c2decc] cursor-pointer inline-flex items-center gap-1 shadow-3xs transition-colors"
                          >
                            <span>🙋 Volunteer</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-gray-400">Unassigned</span>
                        )}

                        {!isTripCompleted && !task.isCompleted && (
                          <button
                            type="button"
                            onClick={() => switchTaskType(task)}
                            className="text-[10px] text-gray-400 hover:text-[#4a6454] cursor-pointer hover:underline"
                            title="Move to Packing List"
                          >
                            ⇄ Move
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Mobile Delete */}
                    {!isTripCompleted && (
                      <button
                        onClick={() => deleteTask(task._id)}
                        className="text-xs text-gray-300 hover:text-red-500 p-1 cursor-pointer transition-colors sm:hidden shrink-0"
                        title="Delete item"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {/* Desktop Right Side: Spacious & Uncluttered */}
                  <div className="hidden sm:flex items-center gap-2 shrink-0">
                    {creator && (
                      <span className="text-[11px] text-gray-500 inline-flex items-center gap-1 bg-white border border-gray-200 px-2 py-0.5 rounded-md shadow-3xs">
                        <span className="text-gray-400">By:</span>
                        <span className="font-semibold text-gray-700 inline-flex items-center gap-1">
                          {getAvatarEmoji(creator.avatarId)} {creator.name}
                        </span>
                      </span>
                    )}

                    {assignedUser ? (
                      <span
                        className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md border shadow-3xs"
                        style={{
                          backgroundColor: isClaimedByMe ? '#eaf3ec' : '#f1f4f1',
                          borderColor: isClaimedByMe ? '#ccead5' : '#e4e5e0',
                          color: isClaimedByMe ? '#1a4427' : '#183124',
                        }}
                      >
                        <span className="text-gray-500 font-normal">Assigned:</span>
                        <span className="font-bold inline-flex items-center gap-1">
                          {getAvatarEmoji(assignedUser.avatarId)} {isClaimedByMe ? 'You' : assignedUser.username}
                        </span>
                        {isClaimedByMe && !isTripCompleted && !task.isCompleted && (
                          <button
                            type="button"
                            onClick={() => assignTask(task._id, null)}
                            className="ml-1 text-[10px] text-gray-400 hover:text-red-500 cursor-pointer font-normal underline"
                            title="Release"
                          >
                            release
                          </button>
                        )}
                      </span>
                    ) : !isTripCompleted && !task.isCompleted ? (
                      <button
                        type="button"
                        onClick={() => assignTask(task._id, currentUserId)}
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#e3efe7] hover:bg-[#d0e5d6] text-[#1a4427] border border-[#c2decc] cursor-pointer inline-flex items-center gap-1 shadow-3xs transition-colors"
                      >
                        <span>🙋 Volunteer</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-400">Unassigned</span>
                    )}

                    {!isTripCompleted && (
                      <>
                        {!task.isCompleted && (
                          <button
                            type="button"
                            onClick={() => switchTaskType(task)}
                            className="text-xs text-gray-400 hover:text-[#4a6454] cursor-pointer hover:underline px-1"
                            title="Move to Packing List"
                          >
                            ⇄ Move
                          </button>
                        )}

                        <button
                          onClick={() => deleteTask(task._id)}
                          className="text-xs text-gray-300 hover:text-red-500 p-1 cursor-pointer transition-colors"
                          title="Delete item"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
