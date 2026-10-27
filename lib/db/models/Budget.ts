import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPriceGuess {
  userId: mongoose.Types.ObjectId;
  amount: number;
  notes?: string;
  updatedAt: Date;
}

export interface IMemberBudget {
  userId: mongoose.Types.ObjectId;
  amount: number;
  updatedAt: Date;
}

export interface IBudgetItem {
  _id?: mongoose.Types.ObjectId;
  title: string;
  category: 'Stay' | 'Transport' | 'Food & Dining' | 'Activities' | 'Shopping' | 'Misc';
  addedBy: mongoose.Types.ObjectId;
  guesses: IPriceGuess[];
  consensusCost: number;
  agreedCost: number | null;
  isLocked: boolean;
  createdAt: Date;
}

export interface IBudget extends Document {
  tripId: mongoose.Types.ObjectId;
  items: IBudgetItem[];
  totalEstimated: number;
  acknowledgments: mongoose.Types.ObjectId[];
  memberBudgets: IMemberBudget[];
  createdAt: Date;
  updatedAt: Date;
}

const MemberBudgetSchema = new Schema<IMemberBudget>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  updatedAt: { type: Date, default: Date.now },
});

const PriceGuessSchema = new Schema<IPriceGuess>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true },
  notes: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
});

const BudgetItemSchema = new Schema<IBudgetItem>({
  title: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ['Stay', 'Transport', 'Food & Dining', 'Activities', 'Shopping', 'Misc'],
    default: 'Activities',
  },
  addedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  guesses: [PriceGuessSchema],
  consensusCost: { type: Number, default: 0 },
  agreedCost: { type: Number, default: null },
  isLocked: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

const BudgetSchema = new Schema<IBudget>({
  tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, unique: true },
  items: [BudgetItemSchema],
  totalEstimated: { type: Number, default: 0 },
  acknowledgments: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  memberBudgets: [MemberBudgetSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export function recalculateBudget(budget: IBudget) {
  let total = 0;
  budget.items.forEach((item) => {
    if (item.guesses && item.guesses.length > 0) {
      const sum = item.guesses.reduce((acc, g) => acc + (g.amount || 0), 0);
      item.consensusCost = Math.round((sum / item.guesses.length) * 100) / 100;
    } else {
      item.consensusCost = 0;
    }

    const effectiveCost =
      item.isLocked && item.agreedCost != null ? item.agreedCost : item.consensusCost;
    total += effectiveCost;
  });
  budget.totalEstimated = Math.round(total * 100) / 100;
  budget.updatedAt = new Date();
}

const Budget: Model<IBudget> = mongoose.models.Budget || mongoose.model<IBudget>('Budget', BudgetSchema);
export default Budget;
