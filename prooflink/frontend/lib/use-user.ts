"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api, ApiError, type User } from "@/lib/api";

// For pages that need a signed-in user. Redirects to /login when there is no session.
export function useRequireUser() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) router.replace("/login");
        else setError("We couldn't reach the server. Check that the backend is running, then refresh.");
      });
  }, [router]);

  return { user, error };
}
