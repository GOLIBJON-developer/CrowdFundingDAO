'use client'
export default function CampaignError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-24 text-center">
      <div className="text-4xl mb-4 opacity-20">◎</div>
      <h2 className="font-display italic text-xl text-zinc-500 mb-2">Couldn't load campaign</h2>
      <p className="text-xs font-mono text-zinc-700 mb-6">{error.message}</p>
      <button onClick={reset}
        className="px-4 py-2 text-xs font-mono bg-zinc-800 text-zinc-300 rounded hover:bg-zinc-700 transition-colors">
        Retry
      </button>
    </div>
  )
}