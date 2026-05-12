import { useContacts } from "@/hooks/useContacts"
import ContactTable from "@/components/crm/ContactTable"

export default function ContactList() {
  const { data, isLoading, error } = useContacts()
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
  return <ContactTable data={data ?? []} />
}
