"use client";

import { useEffect, useMemo, useState } from "react";
import { getUserById } from "@/lib/mockData";
import { useMockData } from "./useMockData";

const STORAGE_KEY = "mock-user-id";
const GUEST_USER_ID = "0";
const FALLBACK_USER_ID = "4";

export const useFakeCurrentUser = () => {
  const { users, isLoading } = useMockData();
  const [selectedUserId, setSelectedUserId] = useState<string>(FALLBACK_USER_ID);

  useEffect(() => {
    if (isLoading) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && (stored === GUEST_USER_ID || getUserById(users, stored))) {
      setSelectedUserId(stored);
    }
  }, [isLoading, users]);

  const setUser = (userId: string) => {
    setSelectedUserId(userId);
    window.localStorage.setItem(STORAGE_KEY, userId);
  };

  const currentUser = useMemo(() => getUserById(users, selectedUserId), [selectedUserId, users]);
  const isGuest = currentUser === null;

  return { selectedUserId, currentUser, isGuest, setUser, users, isLoading };
};
