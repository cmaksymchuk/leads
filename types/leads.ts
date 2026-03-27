/** Canada MVP: row shape for public.leads */
export type LeadStatus = "available" | "sold";

export interface CanadaLeadRow {
  id: string;
  created_at: string;
  updated_at: string;
  fingerprint: string;
  contact_phone: string;
  address: string;
  city: string;
  postal_code: string;
  /** Province/territory code (e.g. ON, BC). */
  region: string;
  payment_shock: number;
  months_to_renewal: number;
  score: number;
  status: LeadStatus;
}
