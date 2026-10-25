import mongoose, { Document, Schema } from 'mongoose';

export type UserRole = 'user' | 'admin';
export type AuthProvider = 'local';

export interface IUser {
  _id: string;
  email: string;
  displayName: string;
  passwordHash?: string | null;
  authProviders: AuthProvider[];
  role: UserRole;
  musicPreferences: string[];
  onboardingCompleted: boolean;
  tokenVersion: number;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends Omit<IUser, '_id'>, Document {}

const userSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Never return password hashes by default
    },
    authProviders: {
      type: [String],
      enum: ['local'],
      default: ['local'],
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      required: true,
    },
    musicPreferences: {
      type: [String],
      default: [],
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const UserModel =
  mongoose.models.User || mongoose.model<IUserDocument>('User', userSchema);
