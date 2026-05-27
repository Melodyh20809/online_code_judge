"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { EMPTY_MOCK_DATA, fetchMockData, type MockDbPayload } from "@/lib/mockData";

export const useMockData = () => {
  const { data: session } = useSession();
  const token = session?.user?.accessToken || null;
  const [data, setData] = useState<MockDbPayload>(EMPTY_MOCK_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetchMockData(token)
      .then((payload) => {
        if (!isMounted) return;
        setData(payload);
      })
      .catch((err: unknown) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "資料載入失敗。");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  return { ...data, isLoading, error };
};
