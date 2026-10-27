import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITask extends Document {
  tripId: mongoose.Types.ObjectId;
  type: 'milestone' | 'errand' | 'gear';
  title: string;
  quantity?: number;
  assignedTo: mongoose.Types.ObjectId | null;
  createdBy?: mongoose.Types.ObjectId | null;
  isCompleted: boolean;
  targetDate?: Date;
  targetTime?: string;
  order?: number;
}

const TaskSchema = new Schema<ITask>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  type: { type: String, enum: ['milestone', 'errand', 'gear'], required: true },
  title: { type: String, required: true, trim: true, minlength: 1 },
  quantity: { type: Number, default: 1, min: 1 },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  isCompleted: { type: Boolean, default: false },
  targetDate: { type: Date },
  targetTime: { type: String, trim: true },
  order: { type: Number, default: 0 },
});
TaskSchema.index({ tripId: 1, type: 1, isCompleted: 1 });
(TaskSchema as any).set('strictPopulate', false);

const Task: Model<ITask> = mongoose.models.Task || mongoose.model<ITask>('Task', TaskSchema);
export default Task;
