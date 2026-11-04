import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  return useQuery({
    queryKey: ["session"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 60_000,
  });
}

export function useRoles() {
  const { data: user } = useSession();
  const q = useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      return (data ?? []).map((r) => r.role as string);
    },
  });
  return user ? (q.data ?? []) : [];
}

export function useIsAdmin() {
  return useRoles().includes("admin");
}

export function useIsStaff() {
  const r = useRoles();
  return r.includes("admin") || r.includes("moderator");
}
