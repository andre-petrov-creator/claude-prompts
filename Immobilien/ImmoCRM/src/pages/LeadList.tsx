import { useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import { useDeals } from "@/hooks/useDeals"
import LeadTable from "@/components/leads/LeadTable"

export default function LeadList() {
  const { data, isLoading, error } = useDeals()
  const [searchParams, setSearchParams] = useSearchParams()
  const contactFilterId = searchParams.get("contact")

  const filteredData = useMemo(() => {
    if (!data || !contactFilterId) return data ?? []
    return data.filter((d) => d.contact?.id === contactFilterId)
  }, [data, contactFilterId])

  const contactFilterName = useMemo(() => {
    if (!data || !contactFilterId) return null
    const match = data.find((d) => d.contact?.id === contactFilterId)
    return match?.contact?.name ?? null
  }, [data, contactFilterId])

  const clearFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete("contact")
    setSearchParams(next, { replace: true })
  }

  if (isLoading) return <div className="text-zinc-500">Lädt…</div>
  if (error) {
    const msg =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error && "message" in error
          ? String((error as { message: unknown }).message)
          : JSON.stringify(error)
    return <div className="text-red-600">Fehler: {msg}</div>
  }
  return (
    <LeadTable
      data={filteredData}
      contactFilter={
        contactFilterId
          ? {
              id: contactFilterId,
              name: contactFilterName,
              matchCount: filteredData.length,
              onClear: clearFilter,
            }
          : null
      }
    />
  )
}
