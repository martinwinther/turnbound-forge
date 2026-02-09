export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 px-6 py-16">
      <main className="mx-auto flex max-w-3xl flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-10 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Turnbound Forge
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900">
            Build planner prototype
          </h1>
          <p className="text-zinc-600">
            Start a new build, unlock grid cells, and explore upcoming tools.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            href="/planner"
          >
            Open Planner
          </a>
          <a
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:border-zinc-300"
            href="/items"
          >
            Browse Items
          </a>
        </div>
      </main>
    </div>
  );
}
