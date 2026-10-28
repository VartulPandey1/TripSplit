'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AVATARS } from '@/lib/constants/avatars';
import Logo from '@/app/components/Logo';

interface SettingsClientProps {
  initialUser: {
    id: string;
    username: string;
    email: string;
    avatarId: string;
    createdAt?: string;
  };
}

export default function SettingsClient({ initialUser }: SettingsClientProps) {
  const router = useRouter();

  // Profile Form State
  const [username, setUsername] = useState(initialUser.username);
  const [avatarId, setAvatarId] = useState(initialUser.avatarId || 'avatar-fox.svg');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      setProfileMsg({ type: 'error', text: 'Username cannot be blank' });
      return;
    }

    setProfileLoading(true);
    setProfileMsg(null);

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          avatarId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      setProfileMsg({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setProfileMsg(null), 4000);
      router.refresh();
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Error updating profile' });
    } finally {
      setProfileLoading(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);

    if (!currentPassword) {
      setPasswordMsg({ type: 'error', text: 'Current password is required' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    setPasswordLoading(true);

    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg(null), 4000);
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.message || 'Error changing password' });
    } finally {
      setPasswordLoading(false);
    }
  }

  const selectedAvatar = AVATARS.find((a) => a.id === avatarId) || AVATARS[0];

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-silk)' }}>
      {/* Top Header */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4"
        style={{
          backgroundColor: 'rgba(247,250,246,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <Logo layout="horizontal" href="/dashboard" />
        <Link
          href="/dashboard"
          className="min-h-[44px] min-w-[44px] text-xs font-medium px-4 py-2 rounded-full transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--color-border)',
            color: 'rgba(26,30,28,0.7)',
            boxShadow: '0 2px 8px -1px rgba(26,30,28,0.04)',
          }}
        >
          <span>←</span>
          <span>Dashboard</span>
        </Link>
      </header>

      {/* Main Container */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-charcoal)' }}
          >
            Account Settings
          </h1>
          <p className="text-xs sm:text-sm mt-1" style={{ color: 'rgba(26,30,28,0.55)' }}>
            Manage your personal profile, avatar, and security credentials
          </p>
        </div>

        {/* 1. Profile & Avatar Card */}
        <section
          className="rounded-3xl p-4 sm:p-6 shadow-xs"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#f1f4f1]">
            <span className="text-lg">👤</span>
            <h2
              className="text-base font-bold text-[#181c1a]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Profile & Avatar
            </h2>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-5">
            {/* Avatar Selection Grid */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Choose Avatar Emoji
                </label>
                <span className="text-xs font-medium text-[#4a6454] flex items-center gap-1">
                  <span>Current:</span>
                  <span className="text-base">{selectedAvatar.emoji}</span>
                  <span className="font-semibold">{selectedAvatar.label}</span>
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 justify-items-center">
                {AVATARS.map((a) => {
                  const isSelected = avatarId === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setAvatarId(a.id)}
                      title={a.label}
                      aria-label={a.label}
                      className={`w-12 h-12 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#4a6454] bg-[#ccead5]/40 text-[#183124] ring-2 ring-[#4a6454] ring-offset-2 shadow-xs'
                          : 'border-gray-200 bg-[#f7faf6] hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      <span className="text-2xl select-none leading-none">{a.emoji}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Username Input */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1.5">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={2}
                maxLength={30}
                placeholder="Your display name"
                className="w-full text-xs sm:text-sm px-4 py-3 rounded-2xl border border-gray-200 outline-none focus:border-[#4a6454] transition-colors"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Visible to fellow travelers in all your shared trip groups and expense ledgers.
              </p>
            </div>

            {profileMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  profileMsg.type === 'success'
                    ? 'bg-[#eef1ee] text-[#183124] border border-[#ccead5]'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                <span>{profileMsg.type === 'success' ? '✓' : '⚠️'}</span>
                <span>{profileMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={profileLoading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#4a6454] hover:bg-[#3d5345] text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
            >
              {profileLoading ? 'Saving Profile…' : 'Save Profile'}
            </button>
          </form>
        </section>

        {/* 2. Security & Password Card */}
        <section
          className="rounded-3xl p-4 sm:p-6 shadow-xs"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#f1f4f1]">
            <span className="text-lg">🔒</span>
            <h2
              className="text-base font-bold text-[#181c1a]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Security & Password
            </h2>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                placeholder="Enter your current password"
                className="w-full text-xs sm:text-sm px-4 py-2.5 rounded-2xl border border-gray-200 outline-none focus:border-[#4a6454] transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Min. 6 characters"
                  className="w-full text-xs sm:text-sm px-4 py-2.5 rounded-2xl border border-gray-200 outline-none focus:border-[#4a6454] transition-colors"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider block mb-1">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Repeat new password"
                  className="w-full text-xs sm:text-sm px-4 py-2.5 rounded-2xl border border-gray-200 outline-none focus:border-[#4a6454] transition-colors"
                />
              </div>
            </div>

            {passwordMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                  passwordMsg.type === 'success'
                    ? 'bg-[#eef1ee] text-[#183124] border border-[#ccead5]'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                <span>{passwordMsg.type === 'success' ? '✓' : '⚠️'}</span>
                <span>{passwordMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-[#4a6454] hover:bg-[#3d5345] text-white text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
            >
              {passwordLoading ? 'Updating Password…' : 'Update Password'}
            </button>
          </form>
        </section>

        {/* 3. Account Information Card */}
        <section
          className="rounded-3xl p-4 sm:p-6 shadow-xs"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid var(--color-border)',
          }}
        >
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#f1f4f1]">
            <span className="text-lg">ℹ️</span>
            <h2
              className="text-base font-bold text-[#181c1a]"
              style={{ fontFamily: 'var(--font-heading)' }}
            >
              Account Information
            </h2>
          </div>

          <div className="divide-y divide-[#f1f4f1] text-xs">
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-gray-500 font-medium">Email Address</span>
              <span className="font-semibold text-[#181c1a] font-mono">{initialUser.email}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between">
              <span className="text-gray-500 font-medium">Account ID</span>
              <span className="font-mono text-gray-400 text-[11px]">{initialUser.id}</span>
            </div>
            {initialUser.createdAt && (
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-gray-500 font-medium">Member Since</span>
                <span className="text-gray-700 font-medium">
                  {new Date(initialUser.createdAt).toLocaleDateString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
