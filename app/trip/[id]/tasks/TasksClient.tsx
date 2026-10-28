'use client';

import { useState, useRef, useEffect } from 'react';
import { getAvatarEmoji } from '@/lib/constants/avatars';

interface TaskUser {
  _id: string;
  username: string;
  avatarId?: string;
}

export interface TaskItem {
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

// Smart quantity parser: Extracts (2x), 2x, x2 or (2) from title if provided
function parseItemInput(input: string): { title: string; quantity: number } {
  const trimmed = input.trim();
  const match = trimmed.match(/^(.*?)(?:\s+(?:\((\d+)\s*x?\)|(\d+)\s*x|x\s*(\d+)))$/i);
  if (match) {
    const cleanTitle = match[1].trim();
    const qtyStr = match[2] || match[3] || match[4];
    const parsedQty = parseInt(qtyStr, 10);
    if (cleanTitle && !isNaN(parsedQty) && parsedQty >= 1) {
      return { title: cleanTitle, quantity: parsedQty };
    }
  }
  return { title: trimmed, quantity: 1 };
}

export default function TasksClient({
  tripId,
  currentUserId,
  members,
  initialTasks,
  isTripCompleted = false,
}: TasksClientProps) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [activeTab, setActiveTab] = useState<'gear' | 'errand'>('gear');
  const [newTitle, setNewTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Collapsible completed sections (hidden by default to cut visual clutter)
  const [showPackedGear, setShowPackedGear] = useState(false);
  const [showCompletedErrands, setShowCompletedErrands] = useState(false);

  // Edit Sheet State
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editQuantity, setEditQuantity] = useState(1);
  const [editAssignedTo, setEditAssignedTo] = useState<string | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingEdit, setIsDeletingEdit] = useState(false);

  // Add Item Sheet State (Slide-Up Bottom Sheet triggered by FAB)
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [sheetType, setSheetType] = useState<'gear' | 'errand'>('gear');
  const [sheetTitle, setSheetTitle] = useState('');
  const [sheetQuantity, setSheetQuantity] = useState(1);
  const [sheetAssignedTo, setSheetAssignedTo] = useState<string | null>(null);
  const [isSubmittingSheet, setIsSubmittingSheet] = useState(false);

  const addInputRef = useRef<HTMLInputElement>(null);

  const memberMap = new Map<string, Member>();
  (members || []).forEach((m) => memberMap.set(m._id, m));

  // Close sheets on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editingTask) closeEditSheet();
        if (isAddSheetOpen) setIsAddSheetOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingTask, isAddSheetOpen]);

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

  const activeGear = gearItems.filter((t) => !t.isCompleted);
  const packedGear = gearItems.filter((t) => t.isCompleted);
  const activeErrands = errands.filter((t) => !t.isCompleted);
  const completedErrands = errands.filter((t) => t.isCompleted);

  const packedGearCount = packedGear.length;
  const completedErrandsCount = completedErrands.length;

  // Single-line Add Bar submission
  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (isTripCompleted) {
      setErrorMessage('This trip is marked completed. Checklists are archived and read-only.');
      return;
    }
    const parsed = parseItemInput(newTitle);
    if (!parsed.title) {
      setErrorMessage('Please enter an item title (cannot be blank or only spaces).');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          type: activeTab,
          title: parsed.title,
          quantity: activeTab === 'gear' ? Math.max(1, parsed.quantity) : 1,
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
        setNewTitle('');
      } else {
        const data = await res.json();
        setErrorMessage(data.error || 'Failed to add item');
      }
    } catch {
      setErrorMessage('Network error');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Slide-Up Bottom Sheet Add submission
  async function handleSheetAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (isTripCompleted) {
      setErrorMessage('This trip is marked completed. Checklists are archived and read-only.');
      return;
    }
    const parsed = parseItemInput(sheetTitle);
    if (!parsed.title) {
      setErrorMessage('Please enter an item title (cannot be blank or only spaces).');
      return;
    }

    setIsSubmittingSheet(true);
    setErrorMessage('');

    try {
      const finalQuantity = sheetType === 'gear' ? Math.max(1, sheetQuantity || parsed.quantity) : 1;
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tripId,
          type: sheetType,
          title: parsed.title,
          quantity: finalQuantity,
          assignedTo: sheetAssignedTo || undefined,
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
        setActiveTab(sheetType);
        setIsAddSheetOpen(false);
        setSheetTitle('');
        setSheetQuantity(1);
        setSheetAssignedTo(null);
      } else {
        const data = await res.json();
        setErrorMessage(data.error || 'Failed to add item');
      }
    } catch {
      setErrorMessage('Network error');
    } finally {
      setIsSubmittingSheet(false);
    }
  }

  // Toggle Complete / Packed
  async function toggleComplete(task: TaskItem) {
    if (isTripCompleted) {
      setErrorMessage('This trip is marked completed. Checklists are archived and read-only.');
      return;
    }
    setErrorMessage('');

    const assignedUser = getAssignedUser(task);
    const assignedId =
      assignedUser?._id ||
      (typeof task.assignedTo === 'string' ? task.assignedTo : task.assignedTo?._id);
    const isAssignedToMe = assignedId === currentUserId;
    const isClaimed = Boolean(assignedUser || task.assignedTo);

    // If claimed by someone else, only that person can toggle completion
    if (isClaimed && !isAssignedToMe) {
      const assignedName = assignedUser?.username || 'the assigned member';
      setErrorMessage(
        `Only ${assignedName} can mark this ${task.type === 'gear' ? 'packed' : 'completed'}.`
      );
      return;
    }

    const newCompleted = !task.isCompleted;
    // Auto-claim if unclaimed and marking done
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
                ? {
                    _id: currentUserId,
                    username: currentUserMember?.username || 'You',
                    avatarId: currentUserMember?.avatarId,
                  }
                : t.assignedTo,
            }
          : t
      )
    );

    const payload: { isCompleted: boolean; assignedTo?: string } = { isCompleted: newCompleted };
    if (autoClaim) {
      payload.assignedTo = currentUserId;
    }

    try {
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
    } catch {
      setErrorMessage('Network error');
      setTasks(
        tasks.map((t) =>
          t._id === task._id
            ? { ...t, isCompleted: task.isCompleted, assignedTo: task.assignedTo }
            : t
        )
      );
    }
  }

  // Claim or Reassign
  async function assignTask(taskId: string, targetUserId: string | null) {
    if (isTripCompleted) {
      setErrorMessage('This trip is marked completed. Checklists are archived and read-only.');
      return;
    }
    const targetTask = tasks.find((t) => t._id === taskId);
    if (targetTask?.isCompleted) {
      setErrorMessage(
        'Completed or packed items cannot be released or reassigned. Uncheck the item first to re-open it.'
      );
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

  // Delete task
  async function deleteTask(id: string) {
    if (isTripCompleted) {
      setErrorMessage('This trip is marked completed. Checklists are archived and read-only.');
      return;
    }
    setTasks(tasks.filter((t) => t._id !== id));
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  }

  // Edit Sheet Functions
  function openEditSheet(task: TaskItem) {
    if (isTripCompleted) return;
    setEditingTask(task);
    setEditTitle(task.title);
    setEditQuantity(task.quantity || 1);
    const assigned = getAssignedUser(task);
    setEditAssignedTo(
      assigned?._id ||
        (typeof task.assignedTo === 'string' ? task.assignedTo : task.assignedTo?._id) ||
        null
    );
    setErrorMessage('');
  }

  function closeEditSheet() {
    setEditingTask(null);
    setEditTitle('');
    setEditQuantity(1);
    setEditAssignedTo(null);
    setIsSavingEdit(false);
    setIsDeletingEdit(false);
  }

  async function handleSaveEditSheet(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!editingTask || isTripCompleted) return;

    const trimmed = editTitle.trim();
    if (!trimmed) {
      setErrorMessage('Title cannot be empty');
      return;
    }

    setIsSavingEdit(true);
    setErrorMessage('');

    try {
      const payload: Record<string, any> = {
        title: trimmed,
        quantity: editingTask.type === 'gear' ? Math.max(1, editQuantity) : 1,
      };

      if (!editingTask.isCompleted) {
        payload.assignedTo = editAssignedTo;
      }

      const res = await fetch(`/api/tasks/${editingTask._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t._id === editingTask._id ? updated : t)));
        closeEditSheet();
      } else {
        const data = await res.json();
        setErrorMessage(data.error || 'Failed to save changes');
      }
    } catch {
      setErrorMessage('Network error');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleMoveCategoryInSheet() {
    if (!editingTask || isTripCompleted) return;
    if (editingTask.isCompleted) {
      setErrorMessage('Completed items cannot be moved. Uncheck the item first to re-open it.');
      return;
    }

    const targetType: 'gear' | 'errand' = editingTask.type === 'gear' ? 'errand' : 'gear';
    setIsSavingEdit(true);
    setErrorMessage('');

    try {
      const res = await fetch(`/api/tasks/${editingTask._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: targetType }),
      });

      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t._id === editingTask._id ? updated : t)));
        setActiveTab(targetType);
        closeEditSheet();
      } else {
        const data = await res.json();
        setErrorMessage(data.error || 'Failed to move item');
      }
    } catch {
      setErrorMessage('Network error');
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteInSheet() {
    if (!editingTask || isTripCompleted) return;
    setIsDeletingEdit(true);
    await deleteTask(editingTask._id);
    closeEditSheet();
  }

  // Render a minimal Reminders-style checklist row
  function renderTaskRow(task: TaskItem) {
    const creator = getTaskCreator(task);
    const assignedUser = getAssignedUser(task);
    const isClaimedByMe = (assignedUser?._id || task.assignedTo?._id) === currentUserId;
    const isClaimed = Boolean(assignedUser || task.assignedTo);
    const canCheck = !isTripCompleted && (!isClaimed || isClaimedByMe);

    return (
      <div
        key={task._id}
        onClick={() => openEditSheet(task)}
        className={`py-3 px-2 sm:px-3 rounded-2xl flex items-center justify-between gap-3 group transition-all cursor-pointer ${
          task.isCompleted
            ? 'bg-transparent hover:bg-gray-50/70'
            : 'bg-white hover:bg-[#f7faf6]'
        }`}
      >
        {/* Left: Checkbox + Compact Quantity Badge + Content */}
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleComplete(task);
            }}
            disabled={!canCheck}
            className={`w-11 h-11 min-w-[44px] min-h-[44px] -ml-2 -my-2 flex items-center justify-center shrink-0 transition-all ${
              !canCheck ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
            title={
              isTripCompleted
                ? 'Trip is completed — checklist is locked'
                : isClaimed && !isClaimedByMe
                ? `Claimed by ${assignedUser?.username || 'another member'}`
                : task.isCompleted
                ? 'Mark incomplete'
                : 'Mark complete'
            }
            aria-label={task.isCompleted ? 'Mark incomplete' : 'Mark complete'}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                task.isCompleted
                  ? 'bg-[#4a6454] text-white border-2 border-[#4a6454]'
                  : 'border-2 border-gray-300 hover:border-[#4a6454] bg-white'
              }`}
            >
              {task.isCompleted && (
                <svg
                  className="w-3 h-3 text-white stroke-[3]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </span>
          </button>

          {/* Compact Quantity Badge: clean pill badge 2x next to checkbox, preventing long item names from wrapping awkwardly */}
          {task.type === 'gear' && (task.quantity || 1) > 1 && (
            <span
              className="text-[10px] sm:text-xs font-bold font-mono px-1.5 py-0.5 rounded-md bg-[#eef3ef] text-[#2d523a] border border-[#cde0d2] shrink-0 leading-none select-none"
              title={`${task.quantity} items needed`}
            >
              {task.quantity}x
            </span>
          )}

          <div className="min-w-0 flex-1">
            {/* Title: Clean text without appended awkward quantity text */}
            <p
              className={`text-xs sm:text-sm leading-snug break-words ${
                task.isCompleted ? 'line-through text-gray-400' : 'text-[#1a1e1c] font-medium'
              }`}
            >
              {task.title}
            </p>

            {/* Reminders-Style Dot-Separated Subtitle */}
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mt-0.5 flex-wrap">
              {creator && (
                <>
                  <span>Added by {creator.name}</span>
                  <span className="text-gray-300">•</span>
                </>
              )}
              {assignedUser ? (
                <span
                  className={
                    isClaimedByMe ? 'text-[#1a4427] font-semibold' : 'text-gray-600 font-medium'
                  }
                >
                  {task.type === 'gear' ? 'Claimed by' : 'Assigned to'}{' '}
                  {isClaimedByMe ? 'You' : assignedUser.username}
                </span>
              ) : (
                <span className="text-gray-400">
                  {task.type === 'gear' ? 'Unclaimed' : 'Unassigned'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: 1-Tap Quick Claim on Mobile (+ Volunteer pill on unassigned items) OR Tap-to-edit indicator */}
        {!isTripCompleted && (
          !task.isCompleted && !assignedUser ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                assignTask(task._id, currentUserId);
              }}
              className="text-[11px] sm:text-xs font-semibold px-2.5 py-1 rounded-full bg-[#eef5f0] hover:bg-[#d8e8dc] text-[#2d523a] border border-[#cde0d2] shadow-2xs flex items-center gap-1 cursor-pointer transition-all active:scale-95 shrink-0"
              title="Claim this item with 1 tap"
            >
              <span className="font-bold text-xs leading-none">+</span>
              <span>Volunteer</span>
            </button>
          ) : (
            <div className="flex items-center gap-1 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors">
              <span className="text-[11px] hidden sm:inline text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                Edit
              </span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          )
        )}
      </div>
    );
  }

  const currentItems = activeTab === 'gear' ? gearItems : errands;
  const currentActiveItems = activeTab === 'gear' ? activeGear : activeErrands;
  const currentDoneItems = activeTab === 'gear' ? packedGear : completedErrands;
  const isDoneExpanded = activeTab === 'gear' ? showPackedGear : showCompletedErrands;
  const setIsDoneExpanded = activeTab === 'gear' ? setShowPackedGear : setShowCompletedErrands;

  return (
    <div className="px-3 py-3 sm:px-6 sm:py-6 max-w-3xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1
          className="text-xl sm:text-3xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-heading)', letterSpacing: '-0.02em', color: 'var(--color-charcoal)' }}
        >
          Checklists & Gear
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">
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
            type="button"
            onClick={() => setErrorMessage('')}
            className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center text-xs font-bold text-amber-700 hover:text-amber-950 cursor-pointer shrink-0"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* TOP TOGGLE: [ 🎒 Packing gear (14) | 📋 Pre-trip tasks (3) ] */}
      <div className="bg-[#ecefeb] p-1 sm:p-1.5 rounded-2xl flex items-center gap-1 shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('gear')}
          className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
            activeTab === 'gear'
              ? 'bg-white text-[#183124] shadow-xs'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <span>🎒</span>
          <span>Packing gear</span>
          <span
            className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
              activeTab === 'gear'
                ? 'bg-[#e3efe7] text-[#1a4427]'
                : 'bg-[#dfe3df] text-gray-600'
            }`}
          >
            {gearItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('errand')}
          className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
            activeTab === 'errand'
              ? 'bg-white text-[#183124] shadow-xs'
              : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <span>📋</span>
          <span>Pre-trip tasks</span>
          <span
            className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-bold transition-colors ${
              activeTab === 'errand'
                ? 'bg-[#e3efe7] text-[#1a4427]'
                : 'bg-[#dfe3df] text-gray-600'
            }`}
          >
            {errands.length}
          </span>
        </button>
      </div>

      {/* MAIN CHECKLIST CARD */}
      <div className="rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-white shadow-xs">
        {/* Card Header & Progress */}
        <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-black/[0.04]">
          <div className="flex items-center gap-2">
            <span className="text-lg sm:text-xl">
              {activeTab === 'gear' ? '🎒' : '📋'}
            </span>
            <div>
              <h2
                className="text-sm sm:text-base font-semibold text-[#1a1e1c]"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                {activeTab === 'gear' ? 'Packing list & gear' : 'Pre-trip tasks'}
              </h2>
              <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">
                {activeTab === 'gear'
                  ? 'Shared equipment, supplies, and items members are bringing'
                  : 'Bookings, reservations, and to-dos to handle before departure'}
              </p>
            </div>
          </div>
          <span className="text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-full bg-[#f1f4f1] text-[#1c4b32]">
            {activeTab === 'gear'
              ? `${packedGearCount}/${gearItems.length} packed`
              : `${completedErrandsCount}/${errands.length} done`}
          </span>
        </div>

        {/* SINGLE-LINE ADD BAR: Apple Reminders-style */}
        {!isTripCompleted ? (
          <form onSubmit={handleAddItem} className="relative flex items-center mb-3 sm:mb-4">
            <input
              ref={addInputRef}
              type="text"
              placeholder={
                activeTab === 'gear'
                  ? 'Add gear item...'
                  : 'Add task...'
              }
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-[#f7faf6] hover:bg-[#f2f6f1] focus:bg-white border border-black/[0.08] focus:border-[#4a6454] rounded-2xl pl-3.5 pr-11 py-2.5 sm:py-3 text-xs sm:text-sm outline-none transition-all placeholder:text-gray-400 text-[#1a1e1c] shadow-xs"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newTitle.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center bg-[#4a6454] text-white hover:bg-[#385041] disabled:opacity-30 disabled:hover:bg-[#4a6454] transition-all cursor-pointer shadow-3xs"
              title={activeTab === 'gear' ? 'Add gear (+)' : 'Add task (+)'}
              aria-label="Add item"
            >
              <span className="text-lg font-light leading-none">+</span>
            </button>
          </form>
        ) : (
          <div className="mb-4 px-3.5 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 flex items-center gap-2">
            <span>🔒</span>
            <span>Archived: Checklist is locked in read-only mode for completed trip.</span>
          </div>
        )}

        {/* CHECKLIST ITEMS */}
        {currentItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-gray-400">
            {activeTab === 'gear'
              ? 'No packing gear added yet. Type an item above or tap + to add to the checklist!'
              : 'No pre-trip tasks added yet. Type a task above or tap + to add to the checklist!'}
          </div>
        ) : (
          <div>
            {/* Active Items */}
            {currentActiveItems.length === 0 && currentDoneItems.length > 0 ? (
              <div className="py-3 px-4 text-center text-xs text-[#244b34] font-medium bg-[#eef4f0] rounded-xl my-1 border border-[#d3e2d7]/60">
                🎉 All {currentDoneItems.length} {activeTab === 'gear' ? 'items are packed' : 'tasks are completed'}!
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-black/[0.04]">
                {currentActiveItems.map(renderTaskRow)}
              </div>
            )}

            {/* COLLAPSIBLE DONE ITEMS: ✓ 8 items packed (tap to view) */}
            {currentDoneItems.length > 0 && (
              <div className="mt-3 pt-3 border-t border-black/[0.04]">
                <button
                  type="button"
                  onClick={() => setIsDoneExpanded((prev) => !prev)}
                  className="w-full flex items-center justify-between py-2 px-2.5 rounded-xl text-xs sm:text-sm font-semibold text-emerald-800 hover:bg-emerald-50/70 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                      ✓
                    </span>
                    <span>
                      {currentDoneItems.length}{' '}
                      {activeTab === 'gear'
                        ? currentDoneItems.length === 1
                          ? 'item packed'
                          : 'items packed'
                        : currentDoneItems.length === 1
                        ? 'task completed'
                        : 'tasks completed'}{' '}
                      <span className="text-gray-500 font-normal">
                        ({isDoneExpanded ? 'tap to hide' : 'tap to view'})
                      </span>
                    </span>
                  </span>
                  <span className="text-xs text-gray-400">
                    {isDoneExpanded ? '▲' : '▼'}
                  </span>
                </button>

                {isDoneExpanded && (
                  <div className="flex flex-col divide-y divide-black/[0.04] mt-1.5 opacity-80">
                    {currentDoneItems.map(renderTaskRow)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* EDIT SHEET SLIDE-UP BOTTOM SHEET */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-2xs transition-opacity"
            onClick={closeEditSheet}
          />

          {/* Sheet Dialog */}
          <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            {/* Mobile drag handle */}
            <div className="w-12 h-1.5 bg-gray-300/80 rounded-full mx-auto mb-3.5 sm:hidden shrink-0 cursor-grab" />

            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {editingTask.type === 'gear' ? '🎒' : '📋'}
                </span>
                <h3
                  className="font-bold text-sm sm:text-base text-gray-900"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  Edit {editingTask.type === 'gear' ? 'packing gear' : 'pre-trip task'}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeEditSheet}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-base font-bold cursor-pointer transition-colors shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditSheet} className="space-y-4">
              {/* Item Title Input */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Item title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-[#f7faf6] border border-black/[0.08] focus:border-[#4a6454] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 outline-none transition-colors"
                  placeholder="Item name"
                  autoFocus
                />
              </div>

              {/* Quantity Stepper (for Gear items) */}
              {editingTask.type === 'gear' && (
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                    Quantity needed
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setEditQuantity((q) => Math.max(1, q - 1))}
                      disabled={editQuantity <= 1}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 disabled:opacity-40 text-gray-700 font-bold text-lg flex items-center justify-center cursor-pointer transition-all shrink-0"
                      title="Decrease quantity"
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>
                    <div className="flex-1 text-center py-2.5 px-3 bg-[#f7faf6] border border-black/[0.08] rounded-xl font-mono text-base font-bold text-gray-900">
                      Quantity: {editQuantity}
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditQuantity((q) => Math.min(99, q + 1))}
                      disabled={editQuantity >= 99}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 disabled:opacity-40 text-gray-700 font-bold text-lg flex items-center justify-center cursor-pointer transition-all shrink-0"
                      title="Increase quantity"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Assignment / Claim Picker */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                  {editingTask.type === 'gear' ? 'Claimed by' : 'Assigned to'}
                </label>
                <select
                  value={editAssignedTo || ''}
                  onChange={(e) => setEditAssignedTo(e.target.value || null)}
                  disabled={editingTask.isCompleted}
                  className="w-full bg-[#f7faf6] border border-black/[0.08] focus:border-[#4a6454] rounded-xl px-3 py-2.5 text-xs sm:text-sm text-gray-900 outline-none disabled:opacity-50 cursor-pointer"
                >
                  <option value="">
                    {editingTask.type === 'gear' ? 'Unclaimed (Anyone can bring)' : 'Unassigned (Anyone can do)'}
                  </option>
                  <option value={currentUserId}>
                    🙋 Claim for myself (You)
                  </option>
                  {members
                    .filter((m) => m._id !== currentUserId)
                    .map((m) => (
                      <option key={m._id} value={m._id}>
                        {getAvatarEmoji(m.avatarId)} {m.username}
                      </option>
                    ))}
                </select>
                {editingTask.isCompleted && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Item is completed. Uncheck to reassign.
                  </p>
                )}
              </div>

              {/* Category Switcher Button */}
              {!editingTask.isCompleted && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleMoveCategoryInSheet}
                    className="w-full min-h-[44px] py-2.5 px-3 rounded-xl border border-dashed border-gray-200 hover:border-gray-400 text-xs font-medium text-gray-600 hover:text-gray-900 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span>⇄</span>
                    <span>
                      Move to {editingTask.type === 'gear' ? 'pre-trip tasks' : 'packing gear'}
                    </span>
                  </button>
                </div>
              )}

              {/* Action Buttons: Delete & Save */}
              <div className="flex items-center gap-2 pt-3 border-t border-black/[0.04]">
                <button
                  type="button"
                  onClick={handleDeleteInSheet}
                  disabled={isDeletingEdit}
                  className="min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs sm:text-sm font-semibold text-red-600 hover:bg-red-50 cursor-pointer transition-colors shrink-0 inline-flex items-center justify-center"
                >
                  {isDeletingEdit ? 'Deleting…' : 'Delete'}
                </button>
                <button
                  type="submit"
                  disabled={!editTitle.trim() || isSavingEdit}
                  className="min-h-[44px] flex-1 py-2.5 px-4 rounded-xl bg-[#4a6454] hover:bg-[#385041] text-white text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-50 transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  {isSavingEdit ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD ITEM SLIDE-UP BOTTOM SHEET (Triggered by thumb FAB) */}
      {isAddSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-2xs transition-opacity"
            onClick={() => setIsAddSheetOpen(false)}
          />

          {/* Sheet Dialog */}
          <div className="relative z-10 w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 shadow-2xl max-h-[85vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            {/* Mobile drag handle */}
            <div className="w-12 h-1.5 bg-gray-300/80 rounded-full mx-auto mb-3.5 sm:hidden shrink-0 cursor-grab" />

            {/* Sheet Header */}
            <div className="flex items-center justify-between pb-3 border-b border-black/[0.04] mb-4">
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {sheetType === 'gear' ? '🎒' : '📋'}
                </span>
                <h3
                  className="font-bold text-sm sm:text-base text-gray-900"
                  style={{ fontFamily: 'var(--font-heading)' }}
                >
                  {sheetType === 'gear' ? 'Add packing gear' : 'Add pre-trip task'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSheetOpen(false)}
                className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-base font-bold cursor-pointer transition-colors shrink-0"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Type Switcher */}
            <div className="bg-[#ecefeb] p-1 rounded-2xl flex items-center gap-1 mb-4 shadow-xs">
              <button
                type="button"
                onClick={() => setSheetType('gear')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  sheetType === 'gear'
                    ? 'bg-white text-[#183124] shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>🎒</span>
                <span>Packing gear</span>
              </button>
              <button
                type="button"
                onClick={() => setSheetType('errand')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  sheetType === 'errand'
                    ? 'bg-white text-[#183124] shadow-xs'
                    : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                <span>📋</span>
                <span>Pre-trip task</span>
              </button>
            </div>

            <form onSubmit={handleSheetAddItem} className="space-y-4">
              {/* Item Title Input */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Item title
                </label>
                <input
                  type="text"
                  value={sheetTitle}
                  onChange={(e) => setSheetTitle(e.target.value)}
                  className="w-full bg-[#f7faf6] border border-black/[0.08] focus:border-[#4a6454] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-gray-900 outline-none transition-colors"
                  placeholder={
                    sheetType === 'gear'
                      ? 'Add gear item...'
                      : 'Add task...'
                  }
                  autoFocus
                />
              </div>

              {/* Quantity Stepper (for Gear items) */}
              {sheetType === 'gear' && (
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                    Quantity needed
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSheetQuantity((q) => Math.max(1, q - 1))}
                      disabled={sheetQuantity <= 1}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 disabled:opacity-40 text-gray-700 font-bold text-lg flex items-center justify-center cursor-pointer transition-all shrink-0"
                      title="Decrease quantity"
                      aria-label="Decrease quantity"
                    >
                      -
                    </button>
                    <div className="flex-1 text-center py-2.5 px-3 bg-[#f7faf6] border border-black/[0.08] rounded-xl font-mono text-base font-bold text-gray-900">
                      Quantity: {sheetQuantity}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSheetQuantity((q) => Math.min(99, q + 1))}
                      disabled={sheetQuantity >= 99}
                      className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl bg-gray-100 hover:bg-gray-200 active:scale-95 disabled:opacity-40 text-gray-700 font-bold text-lg flex items-center justify-center cursor-pointer transition-all shrink-0"
                      title="Increase quantity"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Assignment / Claim Picker */}
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1.5">
                  {sheetType === 'gear' ? 'Claimed by' : 'Assigned to'}
                </label>
                <select
                  value={sheetAssignedTo || ''}
                  onChange={(e) => setSheetAssignedTo(e.target.value || null)}
                  className="w-full bg-[#f7faf6] border border-black/[0.08] focus:border-[#4a6454] rounded-xl px-3 py-2.5 text-xs sm:text-sm text-gray-900 outline-none cursor-pointer"
                >
                  <option value="">
                    {sheetType === 'gear' ? 'Unclaimed (Anyone can bring)' : 'Unassigned (Anyone can do)'}
                  </option>
                  <option value={currentUserId}>
                    🙋 Claim for myself (You)
                  </option>
                  {members
                    .filter((m) => m._id !== currentUserId)
                    .map((m) => (
                      <option key={m._id} value={m._id}>
                        {getAvatarEmoji(m.avatarId)} {m.username}
                      </option>
                    ))}
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-black/[0.04]">
                <button
                  type="button"
                  onClick={() => setIsAddSheetOpen(false)}
                  className="min-h-[44px] py-2.5 px-3.5 rounded-xl text-xs sm:text-sm font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer transition-colors shrink-0 inline-flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!sheetTitle.trim() || isSubmittingSheet}
                  className="min-h-[44px] flex-1 py-2.5 px-4 rounded-xl bg-[#4a6454] hover:bg-[#385041] text-white text-xs sm:text-sm font-semibold cursor-pointer disabled:opacity-50 transition-colors shadow-xs flex items-center justify-center gap-1.5"
                >
                  {isSubmittingSheet ? 'Adding…' : sheetType === 'gear' ? 'Add packing gear' : 'Add pre-trip task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING ACTION BUTTON (FAB) FOR QUICK TASK / GEAR ENTRY */}
      {!isTripCompleted && (
        <button
          type="button"
          onClick={() => {
            setSheetType(activeTab);
            setSheetTitle('');
            setSheetQuantity(1);
            setSheetAssignedTo(null);
            setIsAddSheetOpen(true);
          }}
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] right-4 sm:bottom-8 sm:right-8 z-30 flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#4a6454] hover:bg-[#385041] text-white shadow-lg shadow-black/15 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
          aria-label="Add item"
          title="Add item (+)"
        >
          <span className="text-2xl sm:text-3xl font-light leading-none group-hover:rotate-90 transition-transform duration-200">
            +
          </span>
        </button>
      )}
    </div>
  );
}
