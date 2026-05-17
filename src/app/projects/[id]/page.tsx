import { AppShell } from '@/components/layout/AppShell'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-slate-900">Project</h1>
      <p className="text-slate-500 mt-2 text-base">ID: {id}</p>
    </AppShell>
  )
}
