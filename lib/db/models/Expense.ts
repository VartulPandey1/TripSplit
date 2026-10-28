import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISplitDetail {
  userId: mongoose.Types.ObjectId;
  amountOwed: number;
}

export interface IExpense extends Document {
  tripId: mongoose.Types.ObjectId;
  paidBy: mongoose.Types.ObjectId;
  amount: number;
  description: string;
  category?: string;
  isPersonal?: boolean;
  splitType: 'equal' | 'exact' | 'percentage' | 'personal';
  includedMembers: mongoose.Types.ObjectId[];
  splitDetails: ISplitDetail[];
  receiptImage?: string;
  timestamp: Date;
  isSynced: boolean;
}

const ExpenseSchema = new Schema<IExpense>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true },
  paidBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  description: { type: String, required: true },
  category: { type: String, default: 'Misc' },
  isPersonal: { type: Boolean, default: false },
  splitType: { type: String, default: 'equal' },
  includedMembers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  splitDetails: [{ userId: { type: Schema.Types.ObjectId, ref: 'User' }, amountOwed: Number }],
  receiptImage: { type: String },
  timestamp: { type: Date, default: Date.now },
  isSynced: { type: Boolean, default: true },
});

ExpenseSchema.index({ tripId: 1, timestamp: -1 });

if (process.env.NODE_ENV !== 'production' && mongoose.models.Expense) {
  delete (mongoose.models as any).Expense;
}

const Expense: Model<IExpense> = mongoose.models.Expense || mongoose.model<IExpense>('Expense', ExpenseSchema);
export default Expense;
