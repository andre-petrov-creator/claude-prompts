import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { Database } from '@/types/supabase';
import type { ExtractedContact } from './extractContact';
import { classifyMatch } from './duplicateMatch';
import { groupForExistingDeal } from './groupMail';

type ContactUpdate = Database['public']['Tables']['contacts']['Update'];

export interface InsertLeadInput {
  contact: ExtractedContact;
  deal: {
    address: string | null;
    workspacePath: string;
    onedriveWebUrl: string;
    expose_url: string | null;
    inboxMessageId: string;
    inReplyTo?: string;
    priorityScore: number | null;
    priorityReason: string | null;
    newFilenames: string[];
  };
}

export interface InsertLeadResult {
  contactId: string;
  dealId: string;
  matchKind: 'hard' | 'soft' | 'none';
  groupingKind: 'new' | 'existing';
  warning: string | null;
}

export async function insertLead(input: InsertLeadInput): Promise<InsertLeadResult> {
  const supa = supabaseAdmin();

  const nameTail = input.contact.name.split(/\s+/).pop() || input.contact.name;
  const { data: existing } = await supa
    .from('contacts')
    .select('id, email, name, phone, company')
    .or(`email.eq.${input.contact.email},name.ilike.%${nameTail}%`)
    .is('deleted_at', null)
    .limit(20);

  const match = classifyMatch({
    newContact: { email: input.contact.email, name: input.contact.name },
    existing: existing?.map((e) => ({ email: e.email || '', name: e.name })) || [],
  });

  let contactId: string;
  let warning: string | null = null;

  if (match.kind === 'hard') {
    const matched = existing![match.existingIndex];
    contactId = matched.id;
    const updates: ContactUpdate = {};
    if (!matched.phone && input.contact.phone) updates.phone = input.contact.phone;
    if (!matched.company && input.contact.companyName) updates.company = input.contact.companyName;
    if (Object.keys(updates).length) {
      await supa.from('contacts').update(updates).eq('id', contactId);
    }
  } else if (match.kind === 'soft') {
    const matchedSoft = existing![match.existingIndex];
    const inserted = await supa
      .from('contacts')
      .insert({
        name: input.contact.name,
        email: input.contact.email,
        phone: input.contact.phone,
        company: input.contact.companyName,
        position: input.contact.position,
        status: 'kalt',
      })
      .select('id')
      .single();
    contactId = inserted.data!.id;
    warning = `Duplikat-Verdacht: ähnlicher Name wie ${matchedSoft.name} (${matchedSoft.email})`;
    await supa.from('contact_comments').insert({
      contact_id: contactId,
      text: `⚠️ ${warning}`,
    });
  } else {
    const inserted = await supa
      .from('contacts')
      .insert({
        name: input.contact.name,
        email: input.contact.email,
        phone: input.contact.phone,
        company: input.contact.companyName,
        position: input.contact.position,
        status: 'kalt',
      })
      .select('id')
      .single();
    contactId = inserted.data!.id;
  }

  const grouping = await groupForExistingDeal({
    address: input.deal.address,
    contactId,
    inReplyTo: input.deal.inReplyTo,
  });

  if (grouping.kind === 'existing' && grouping.existingDealId) {
    try {
      await supa.from('deal_notes').insert({
        deal_id: grouping.existingDealId,
        content_html: `Nachreichung am ${new Date().toISOString().split('T')[0]}: ${input.deal.newFilenames.join(', ')}`,
      });
    } catch {
      // bestehender Deal bleibt auch wenn Note-Insert fehlschlägt
    }
    return {
      contactId,
      dealId: grouping.existingDealId,
      matchKind: match.kind,
      groupingKind: 'existing',
      warning,
    };
  }

  const inserted = await supa
    .from('deals')
    .insert({
      contact_id: contactId,
      status: 'pre_screened',
      address: input.deal.address,
      expose_url: input.deal.expose_url,
      expose_local_path: input.deal.workspacePath,
      workspace_path: input.deal.workspacePath,
      priority_score: input.deal.priorityScore,
      priority_reason: input.deal.priorityReason,
      expose_source: 'mail-pipeline',
      inbox_message_id: input.deal.inboxMessageId,
      angebot_datum: new Date().toISOString().split('T')[0],
    })
    .select('id')
    .single();

  const dealId = inserted.data!.id;

  await supa.from('activity_log').insert({
    contact_id: contactId,
    deal_id: dealId,
    type: 'new_lead',
  });

  return {
    contactId,
    dealId,
    matchKind: match.kind,
    groupingKind: 'new',
    warning,
  };
}
