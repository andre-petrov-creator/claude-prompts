import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  quickLeadSchema,
  OBJECT_TYPES,
  LEAD_SOURCES,
  type QuickLeadFormValues,
  type QuickLeadParsed,
} from "./leadCreateSchema"
import ContactComboboxField from "./ContactComboboxField"
import SoftMatchDialog from "./SoftMatchDialog"
import DealDuplicateDialog from "./DealDuplicateDialog"
import {
  useCreateLead,
  resolveContactMatch,
  resolveDealDuplicate,
  type CreateLeadResolution,
  type DealDuplicateResolution,
} from "./useCreateLead"
import type { ContactSearchResult } from "./useContactSearch"
import { toast } from "sonner"

type Props = {
  onSuccess: () => void
}

export default function QuickLeadForm({ onSuccess }: Props) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<QuickLeadFormValues>({
    resolver: zodResolver(quickLeadSchema),
    defaultValues: {
      contact_position: "Makler",
    },
  })

  const objectType = watch("object_type")
  const contactId = watch("contact_id")

  const [contactReso, setContactReso] = useState<CreateLeadResolution | null>(
    null,
  )
  const [dealReso, setDealReso] = useState<DealDuplicateResolution | null>(null)
  const [pendingValues, setPendingValues] = useState<QuickLeadParsed | null>(
    null,
  )

  const createLead = useCreateLead()

  const handleExistingContact = (c: ContactSearchResult) => {
    setValue("contact_id", c.id)
    setValue("contact_name", c.name)
    setValue("contact_email", c.email ?? undefined)
    setValue("contact_phone", c.phone ?? undefined)
    setValue("contact_company", c.company ?? undefined)
    setValue("contact_position", c.position ?? "Makler")
  }

  const commit = async (
    parsed: QuickLeadParsed,
    cReso: CreateLeadResolution,
    dReso: DealDuplicateResolution,
  ) => {
    await createLead.mutateAsync({
      values: parsed,
      contactResolution: cReso,
      dealResolution: dReso,
    })
    reset({ contact_position: "Makler" })
    setContactReso(null)
    setDealReso(null)
    setPendingValues(null)
    onSuccess()
  }

  const onSubmit = async (raw: QuickLeadFormValues) => {
    const parsed = quickLeadSchema.parse(raw)
    setPendingValues(parsed)

    try {
      let cReso: CreateLeadResolution
      if (parsed.contact_id) {
        cReso = {
          kind: "hard_match",
          contactId: parsed.contact_id,
          contactName: parsed.contact_name,
        }
      } else {
        cReso = await resolveContactMatch(
          parsed.contact_name,
          parsed.contact_email ?? null,
        )
      }

      if (cReso.kind === "soft_match_pending") {
        setContactReso(cReso)
        return
      }

      const knownContactId =
        cReso.kind === "hard_match"
          ? cReso.contactId
          : cReso.kind === "soft_match_merge"
            ? cReso.contactId
            : null

      let dReso: DealDuplicateResolution = { kind: "no_dup" }
      if (knownContactId) {
        dReso = await resolveDealDuplicate(
          knownContactId,
          parsed.address,
          parsed.zip ?? null,
          parsed.wohnflaeche_m2 ?? null,
        )
        if (dReso.kind === "dup_pending") {
          setContactReso(cReso)
          setDealReso(dReso)
          return
        }
      }

      await commit(parsed, cReso, dReso)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Fehler beim Speichern: ${msg}`)
    }
  }

  const handleMerge = async (mergeId: string) => {
    if (!pendingValues) return
    const cReso: CreateLeadResolution = {
      kind: "soft_match_merge",
      contactId: mergeId,
    }
    try {
      const dReso = await resolveDealDuplicate(
        mergeId,
        pendingValues.address,
        pendingValues.zip ?? null,
        pendingValues.wohnflaeche_m2 ?? null,
      )
      if (dReso.kind === "dup_pending") {
        setContactReso(cReso)
        setDealReso(dReso)
        return
      }
      await commit(pendingValues, cReso, dReso)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Fehler: ${msg}`)
    }
  }

  const handleCreateNewContact = async () => {
    if (!pendingValues) return
    const cReso: CreateLeadResolution = { kind: "soft_match_new" }
    await commit(pendingValues, cReso, { kind: "no_dup" })
  }

  const handleCancel = () => {
    setContactReso(null)
    setDealReso(null)
    setPendingValues(null)
  }

  const handleProceedAnyway = async () => {
    if (!pendingValues || !contactReso) return
    await commit(pendingValues, contactReso, { kind: "dup_proceed_anyway" })
  }

  const selectClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-zinc-700 mb-2">
            Kontakt
          </legend>

          <div>
            <Label>
              Name<span className="text-red-500">*</span>
            </Label>
            <Controller
              control={control}
              name="contact_name"
              render={({ field }) => (
                <ContactComboboxField
                  value={(field.value as string | undefined) ?? ""}
                  onChange={(v) => field.onChange(v)}
                  onSelectExisting={handleExistingContact}
                  onClearSelection={() => setValue("contact_id", undefined)}
                  selectedContactId={contactId}
                />
              )}
            />
            {errors.contact_name && (
              <p className="text-xs text-red-600 mt-1">
                {errors.contact_name.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-Mail</Label>
              <Input type="email" {...register("contact_email")} />
              {errors.contact_email && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.contact_email.message}
                </p>
              )}
            </div>
            <div>
              <Label>Telefon</Label>
              <Input type="tel" {...register("contact_phone")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Firma</Label>
              <Input {...register("contact_company")} />
            </div>
            <div>
              <Label>Position</Label>
              <Input {...register("contact_position")} placeholder="Makler" />
            </div>
          </div>
        </fieldset>

        <fieldset className="space-y-3 pt-2 border-t">
          <legend className="text-sm font-semibold text-zinc-700 mb-2">
            Objekt
          </legend>

          <div>
            <Label>
              Adresse<span className="text-red-500">*</span>
            </Label>
            <Input {...register("address")} placeholder="Talstr. 10" />
            {errors.address && (
              <p className="text-xs text-red-600 mt-1">
                {errors.address.message}
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>PLZ</Label>
              <Input {...register("zip")} />
            </div>
            <div className="col-span-2">
              <Label>Stadt</Label>
              <Input {...register("city")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>
                Objekttyp<span className="text-red-500">*</span>
              </Label>
              <select
                className={selectClass}
                {...register("object_type")}
                defaultValue=""
              >
                <option value="" disabled>
                  Wählen…
                </option>
                {OBJECT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {errors.object_type && (
                <p className="text-xs text-red-600 mt-1">
                  {errors.object_type.message}
                </p>
              )}
            </div>

            {objectType === "MFH" && (
              <div>
                <Label>
                  Einheiten<span className="text-red-500">*</span>
                </Label>
                <Input type="number" min="1" {...register("einheiten")} />
                {errors.einheiten && (
                  <p className="text-xs text-red-600 mt-1">
                    {errors.einheiten.message}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <Label>
              Lead-Herkunft<span className="text-red-500">*</span>
            </Label>
            <select
              className={selectClass}
              {...register("lead_source")}
              defaultValue=""
            >
              <option value="" disabled>
                Wählen…
              </option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            {errors.lead_source && (
              <p className="text-xs text-red-600 mt-1">
                {errors.lead_source.message}
              </p>
            )}
          </div>
        </fieldset>

        <fieldset className="space-y-3 pt-2 border-t">
          <legend className="text-sm font-semibold text-zinc-700 mb-2">
            Optional
          </legend>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Wohnfläche (m²)</Label>
              <Input
                type="text"
                inputMode="decimal"
                {...register("wohnflaeche_m2")}
              />
            </div>
            <div>
              <Label>Preis Kauf (€)</Label>
              <Input
                type="text"
                inputMode="decimal"
                {...register("preis_kauf")}
              />
            </div>
            <div>
              <Label>Kalk Verkauf (€)</Label>
              <Input
                type="text"
                inputMode="decimal"
                {...register("kalk_verkaufspreis")}
              />
            </div>
          </div>

          <div>
            <Label>Exposé-URL</Label>
            <Input
              type="url"
              placeholder="https://…"
              {...register("expose_url")}
            />
            {errors.expose_url && (
              <p className="text-xs text-red-600 mt-1">
                {errors.expose_url.message}
              </p>
            )}
          </div>
        </fieldset>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button type="submit" disabled={isSubmitting || createLead.isPending}>
            {isSubmitting || createLead.isPending ? "Speichern…" : "Lead anlegen"}
          </Button>
        </div>
      </form>

      <SoftMatchDialog
        open={
          contactReso?.kind === "soft_match_pending" &&
          dealReso?.kind !== "dup_pending"
        }
        candidates={
          contactReso?.kind === "soft_match_pending"
            ? contactReso.candidates
            : []
        }
        onMerge={handleMerge}
        onCreateNew={handleCreateNewContact}
        onCancel={handleCancel}
      />

      <DealDuplicateDialog
        open={dealReso?.kind === "dup_pending"}
        duplicates={dealReso?.kind === "dup_pending" ? dealReso.duplicates : []}
        onProceedAnyway={handleProceedAnyway}
        onCancel={handleCancel}
      />
    </>
  )
}
