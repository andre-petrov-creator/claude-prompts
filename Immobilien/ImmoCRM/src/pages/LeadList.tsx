import { useDeals } from "@/hooks/useDeals"
import LeadTable from "@/components/leads/LeadTable"

export default function LeadList() {
  const { data, isLoading, error } = useDeals()
  if (isLoading) return <div className="text-zinc-500">Lädt…</div>
  if (error)
    return <div className="text-red-600">Fehler: {String(error)}</div>
  return <LeadTable data={data ?? []} />
}
