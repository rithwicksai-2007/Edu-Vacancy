import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: string;
          full_name: string;
          email: string;
          phone: string;
          security_question: string;
          security_answer_hash: string;
        };
        Insert: {
          id: string;
          role: string;
          full_name: string;
          email: string;
          phone: string;
          security_question: string;
          security_answer_hash: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      job_seeker_details: {
        Row: {
          id: string;
          subject: string;
          qualification: string;
          years_experience: number;
          preferred_location: string;
          resume_url: string | null;
        };
        Insert: {
          id: string;
          subject: string;
          qualification: string;
          years_experience: number;
          preferred_location: string;
          resume_url?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["job_seeker_details"]["Insert"]
        >;
        Relationships: [];
      };
      institution_details: {
        Row: {
          id: string;
          institution_name: string;
          institution_type: string;
          address: string;
          contact_person: string;
          contact_designation: string;
          registration_number: string;
          city: string;
          state: string;
          pincode: string;
          website: string | null;
          verified: boolean;
        };
        Insert: {
          id: string;
          institution_name: string;
          institution_type: string;
          address: string;
          contact_person: string;
          contact_designation: string;
          registration_number: string;
          city: string;
          state: string;
          pincode: string;
          website?: string | null;
          verified: boolean;
        };
        Update: Partial<
          Database["public"]["Tables"]["institution_details"]["Insert"]
        >;
        Relationships: [];
      };
      institution_certificates: {
        Row: {
          institution_id: string;
          file_url: string;
          cert_type: string;
        };
        Insert: {
          institution_id: string;
          file_url: string;
          cert_type: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["institution_certificates"]["Insert"]
        >;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let supabaseClient: SupabaseClient<Database> | undefined;

export function usernameAuthEmail(username: string) {
  return `${username.trim().toLowerCase()}@users.eduvacancy.invalid`;
}

export function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(supabaseUrl);
  } catch {
    throw new Error(
      "VITE_SUPABASE_URL must be a valid HTTP or HTTPS URL. Update it in your .env file.",
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(
      "VITE_SUPABASE_URL must be a valid HTTP or HTTPS URL. Update it in your .env file.",
    );
  }

  supabaseClient = createClient<Database>(supabaseUrl, supabaseAnonKey);
  return supabaseClient;
}
