export interface AvatarOption {
  id: string;
  emoji: string;
  label: string;
}

export const AVATARS: AvatarOption[] = [
  { id: 'avatar-fox.svg', emoji: '🦊', label: 'Fox' },
  { id: 'avatar-panda.svg', emoji: '🐼', label: 'Panda' },
  { id: 'avatar-bear.svg', emoji: '🐻', label: 'Bear' },
  { id: 'avatar-cat.svg', emoji: '🐱', label: 'Cat' },
  { id: 'avatar-owl.svg', emoji: '🦉', label: 'Owl' },
  { id: 'avatar-tiger.svg', emoji: '🐯', label: 'Tiger' },
];

export function getAvatarEmoji(avatarId?: string | null): string {
  if (!avatarId) return '🦊';
  const found = AVATARS.find(a => a.id === avatarId);
  return found ? found.emoji : '🦊';
}
