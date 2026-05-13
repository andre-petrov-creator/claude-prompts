import { supabaseAdmin } from '@/lib/supabaseAdmin';

export interface GroupingInput {
  address: string | null;
  contactId: string | null;
  inReplyTo: string | undefined;
}

export interface GroupingResult {
  kind: 'new' | 'existing';
  existingDealId?: string;
}

export async function groupForExistingDeal(input: GroupingInput): Promise<GroupingResult> {
  if (!input.contactId) return { kind: 'new' };

  const supa = supabaseAdmin();

  if (input.address) {
    const { data: byAddress } = await supa
      .from('deals')
      .select('id')
      .eq('contact_id', input.contactId)
      .eq('status', 'pre_screened')
      .eq('address', input.address)
      .is('deleted_at', null)
      .limit(1);
    if (byAddress && byAddress.length > 0) {
      return { kind: 'existing', existingDealId: byAddress[0].id };
    }
  }

  if (input.inReplyTo) {
    const { data: byReply } = await supa
      .from('mail_queue')
      .select('deal_id')
      .eq('message_id', input.inReplyTo)
      .not('deal_id', 'is', null)
      .limit(1);
    if (byReply && byReply.length > 0 && byReply[0].deal_id) {
      const { data: deal } = await supa
        .from('deals')
        .select('id, status')
        .eq('id', byReply[0].deal_id)
        .single();
      if (deal && deal.status === 'pre_screened') {
        return { kind: 'existing', existingDealId: deal.id };
      }
    }
  }

  return { kind: 'new' };
}
