export default function Home() {
  return (
    <div className="px-4 py-12 sm:px-6">
      <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 rounded-xl border border-zinc-800 bg-zinc-900/80 p-10 shadow-[0_16px_30px_rgba(0,0,0,0.32)]">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">
            Turnbound Forge
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-100">
            Build planner prototype
          </h1>
          <p className="max-w-2xl text-zinc-300">
            Start a new build, unlock grid cells, and explore upcoming tools.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            className="rounded-md border border-amber-400/70 bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            href="/planner"
          >
            Open Planner
          </a>
          <a
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            href="/items"
          >
            Browse Items
          </a>
        </div>
      </main>
    </div>
  );
}
