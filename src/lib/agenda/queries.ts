import type { SupabaseClient } from "@supabase/supabase-js";

export async function fetchWorkshopProfile(supabase: SupabaseClient) {
  return supabase
    .from("profiles")
    .select("workshop_id")
    .single();
}

export async function fetchWorkshopCapacity(
  supabase: SupabaseClient,
  workshopId: string
) {
  return supabase
    .from("workshops")
    .select("agenda_capacity")
    .eq("id", workshopId)
    .single();
}

export async function fetchClients(
  supabase: SupabaseClient,
  workshopId: string
) {
  return supabase
    .from("clients")
    .select(
      "*, vehicles(id, client_id, brand, model, plate, year, photo_url_1, photo_url_2)"
    )
    .eq("workshop_id", workshopId)
    .order("name", { ascending: true });
}

export async function fetchServices(
  supabase: SupabaseClient,
  workshopId: string
) {
  return supabase
    .from("services")
    .select("id, name, price, duration_minutes, active")
    .eq("workshop_id", workshopId)
    .eq("active", true)
    .order("name", { ascending: true });
}

export async function fetchAppointments(
  supabase: SupabaseClient,
  workshopId: string
) {
  return supabase
    .from("service_orders")
    .select(
      `
        id,
        client_id,
        vehicle_id,
        status,
        total_amount,
        notes,
        scheduled_date,
        scheduled_end_date,
        scheduled_start,
        scheduled_end,
        clients(name),
        vehicles(brand, model, plate),
        service_order_items(
          service_id,
          unit_price,
          services(id, name, price, duration_minutes)
        )
      `
    )
    .eq("workshop_id", workshopId)
    .not("scheduled_date", "is", null)
    .order("scheduled_date", { ascending: true })
    .order("scheduled_start", { ascending: true });
}

export async function fetchAppointmentsLegacy(
  supabase: SupabaseClient,
  workshopId: string
) {
  return supabase
    .from("service_orders")
    .select(
      `
            id,
            client_id,
            vehicle_id,
            status,
            total_amount,
            notes,
            scheduled_date,
            scheduled_start,
            scheduled_end,
            clients(name),
            vehicles(brand, model, plate),
            service_order_items(
              service_id,
              unit_price,
              services(id, name, price, duration_minutes)
            )
          `
    )
    .eq("workshop_id", workshopId)
    .not("scheduled_date", "is", null)
    .order("scheduled_date", { ascending: true })
    .order("scheduled_start", { ascending: true });
}
