import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { connectDB } from '@/lib/db/mongoose';
import Expense from '@/lib/db/models/Expense';
import Task from '@/lib/db/models/Task';
import Trip from '@/lib/db/models/Trip';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;

  const { offlineActions } = await req.json();
  if (!Array.isArray(offlineActions)) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  await connectDB();
  const results = [];

  // Cache trip memberships to minimize redundant queries
  const membershipCache: Record<string, boolean> = {};
  async function checkMembership(tripId: string): Promise<boolean> {
    if (membershipCache[tripId] !== undefined) return membershipCache[tripId];
    const trip = await Trip.findById(tripId);
    if (!trip) {
      membershipCache[tripId] = false;
      return false;
    }
    const isMember =
      trip.members.some((m: any) => m.toString() === userId) ||
      trip.creatorId?.toString() === userId;
    membershipCache[tripId] = isMember;
    return isMember;
  }

  for (const action of offlineActions) {
    const queueId = action.queueId;
    try {
      switch (action.type) {
        case 'CREATE_EXPENSE': {
          const tripId = action.payload?.tripId;
          if (!tripId || !(await checkMembership(tripId))) {
            results.push({ queueId, type: action.type, success: false, error: 'Forbidden: not a trip member' });
            break;
          }

          const expense = await Expense.create({
            ...action.payload,
            paidBy: session.user.id,
            isSynced: true,
            timestamp: action.payload.timestamp ? new Date(action.payload.timestamp) : new Date(),
          });
          results.push({ queueId, type: action.type, success: true, id: expense._id });
          break;
        }

        case 'CLAIM_GEAR':
        case 'COMPLETE_TASK': {
          const taskId = action.payload?.taskId;
          if (!taskId) {
            results.push({ queueId, type: action.type, success: false, error: 'Missing taskId' });
            break;
          }

          const existingTask = await Task.findById(taskId);
          if (!existingTask) {
            results.push({ queueId, type: action.type, success: false, error: 'Task not found' });
            break;
          }

          if (!(await checkMembership(existingTask.tripId.toString()))) {
            results.push({ queueId, type: action.type, success: false, error: 'Forbidden: not a trip member' });
            break;
          }

          const update: any = {};
          if (action.type === 'CLAIM_GEAR') update.assignedTo = session.user.id;
          if (action.type === 'COMPLETE_TASK') update.isCompleted = true;

          const updatedTask = await Task.findByIdAndUpdate(taskId, update, { new: true });
          results.push({ queueId, type: action.type, success: true, id: updatedTask?._id });
          break;
        }

        case 'CREATE_TASK': {
          const tripId = action.payload?.tripId;
          if (!tripId || !(await checkMembership(tripId))) {
            results.push({ queueId, type: action.type, success: false, error: 'Forbidden: not a trip member' });
            break;
          }

          const task = await Task.create({
            ...action.payload,
            assignedTo: action.payload.assignedTo || null,
          });
          results.push({ queueId, type: action.type, success: true, id: task._id });
          break;
        }

        default:
          results.push({ queueId, type: action.type, success: false, error: 'Unknown action type' });
      }
    } catch (err: any) {
      results.push({ queueId, type: action.type, success: false, error: err.message });
    }
  }

  return NextResponse.json({ results });
}
