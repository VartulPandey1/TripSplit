/**
 * AuthCard — centered white card wrapper used on Login, Register,
 * New Trip and Join Trip pages. Implements the Stitch "Ethereal Sanctuary"
 * elevation spec: white surface, rounded-xl, ultra-soft ambient shadow.
 */
export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-3 py-6 sm:px-4 sm:py-12"
      style={{ backgroundColor: 'var(--color-silk)' }}
    >
      <div
        className="w-full max-w-[440px] rounded-3xl px-5 py-7 sm:px-8 sm:py-10"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--color-border)',
          boxShadow: '0 12px 32px -4px rgba(26,30,28,0.06)',
        }}
      >
        {children}
      </div>
    </main>
  );
}
