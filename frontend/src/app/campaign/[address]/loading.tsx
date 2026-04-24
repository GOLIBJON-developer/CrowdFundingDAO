export default function CampaignLoading() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 space-y-6 animate-pulse">
      {/* badges */}
      <div className="flex gap-3">
        <div className="h-6 w-20 bg-zinc-800 rounded" />
        <div className="h-6 w-40 bg-zinc-800 rounded" />
      </div>
      {/* title */}
      <div className="h-10 w-3/4 bg-zinc-800 rounded" />
      <div className="h-4 w-full bg-zinc-800/60 rounded" />
      <div className="h-4 w-2/3 bg-zinc-800/60 rounded" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
        {/* main */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-40 bg-zinc-800/40 rounded-lg border border-zinc-800" />
          <div className="grid grid-cols-3 gap-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-16 bg-zinc-800/40 rounded-lg border border-zinc-800" />
            ))}
          </div>
        </div>
        {/* sidebar */}
        <div className="space-y-4">
          <div className="h-52 bg-zinc-800/40 rounded-lg border border-zinc-800" />
        </div>
      </div>
    </div>
  )
}