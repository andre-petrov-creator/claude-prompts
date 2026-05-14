import { supabaseAdmin } from '../../src/lib/supabaseAdmin.js';
import type { Database } from '../../src/types/supabase.js';
import type { ExtractedContact } from './extractContact.js';
import { classifyMatch } from './duplicateMatch.js';
import { groupForExistingDeal } from './groupMail.js';

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

  if (!input.contact.email) {
    throw new Error('insertLead: contact.email is empty — cannot match or insert without an email');
  }

  // Zwei getrennte Lookup-Queries statt .or() mit String-Konkatenation.
  // Grund: PostgREST .or() mit user-controllable Input (name aus Mail-Header) ist anfällig
  // für Filter-Injection durch Sonderzeichen.
  const nameTail = (input.contact.name.split(/\s+/).pop() || input.contact.name).replace(/[,()%*]/g, '');

  const [byEmail, byName] = await Promise.all([
    supa.from('contacts').select('id, email, name, phone, company').eq('email', input.contact.email).is('deleted_at', null).limit(5),
    nameTail.length >= 3
      ? supa.from('contacts').select('id, email, name, phone, company').ilike('name', `%${nameTail}%`).is('deleted_at', null).limit(20)
      : Promise.resolve({ data: [] as Array<{ id: string; email: string | null; name: string; phone: string | null; company: string | null }> }),
  ]);

  const seen = new Set<string>();
  const existing: Array<{ id: string; email: string | null; name: string; phone: string | null; company: string | null }> = [];
  for (const row of [...(byEmail.data || []), ...(byName.data || [])]) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    existing.push(row);
  }

  const match = classifyMatch({
    newContact: { email: input.contact.email, name: input.contact.name },
    existing: existing.map((e) => ({ email: e.email || '', name: e.name })),
  });

  let contactId: string;
  let warning: string | null = null;

  if (match.kind === 'hard') {
    const matched = existing[match.existingIndex];
    contactId = matched.id;
    const updates: ContactUpdate = {};
    if (!matched.phone && input.contact.phone) updates.phone = input.contact.phone;
    if (!matched.company && input.contact.companyName) updates.company = input.contact.companyName;
    if (Object.keys(updates).length) {
      await supa.from('contacts').update(updates).eq('id', contactId);
    }
  } else if (match.kind === 'soft') {
    const matchedSoft = existing[match.existingIndex];
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
    if (!inserted.data) {
      throw new Error(`contact insert failed (soft-match path): ${inserted.error?.message}`);
    }
    contactId = inserted.data.id;
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
    if (!inserted.data) {
      throw new Error(`contact insert failed (no-match path): ${inserted.error?.message}`);
    }
    contactId = inserted.data.id;
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
  if (!inserted.data) {
    throw new Error(`deal insert failed: ${inserted.error?.message}`);
  }
  const dealId = inserted.data.id;

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
