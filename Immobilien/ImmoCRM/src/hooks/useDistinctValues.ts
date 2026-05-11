import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"

type Table = "contacts" | "deals"

export const useDistinctValues = (table: Table, column: string) => {
  return useQuery<string[]>({
    queryKey: ["distinct", table, column],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from(table).select(column)
      if (error) throw error
      const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
      const set = new Set<string>()
      for (const row of rows) {
        const v = row[column]
        if (typeof v === "string" && v.trim()) set.add(v.trim())
      }
      return Array.from(set).sort((a, b) => a.localeCompare(b))
    },
  })
}
