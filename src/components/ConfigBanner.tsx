export default function ConfigBanner() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card max-w-lg p-8">
        <div className="mb-2 text-3xl">🔌</div>
        <h1 className="mb-2 text-xl font-bold">Connect your Supabase project</h1>
        <p className="mb-4 text-sm text-gray-600">
          SplitUp needs a cloud database to run. It looks like the environment variables
          aren&apos;t set yet. Two quick steps:
        </p>
        <ol className="mb-4 list-decimal space-y-2 pl-5 text-sm text-gray-700">
          <li>
            Create a free project at{' '}
            <a
              className="font-medium text-brand-600 underline"
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              supabase.com/dashboard
            </a>
            , then run <code className="rounded bg-gray-100 px-1">supabase/migrations/0001_init.sql</code>{' '}
            in the SQL editor.
          </li>
          <li>
            Copy <code className="rounded bg-gray-100 px-1">.env.example</code> to{' '}
            <code className="rounded bg-gray-100 px-1">.env.local</code>, paste your project URL
            and anon key, then restart <code className="rounded bg-gray-100 px-1">npm run dev</code>.
          </li>
        </ol>
        <p className="text-xs text-gray-400">
          Find the URL and anon key under Project Settings → API in your Supabase dashboard.
        </p>
      </div>
    </div>
  )
}
