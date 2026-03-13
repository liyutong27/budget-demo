"use client";

import { useState, useEffect, useRef } from "react";
import { DashboardData } from "./types";

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: DashboardData;
  timestamp: number;
}

// Module-level cache shared across hook instances
let cache: CacheEntry | null = null;

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(cache?.data ?? null);
  const [loading, setLoading] = useState(!cache?.data);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // If we have fresh cache, use it
    if (cache && Date.now() - cache.timestamp < CACHE_TTL) {
      setData(cache.data);
      setLoading(false);
      return;
    }

    // Prevent duplicate fetches in StrictMode
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    async function load() {
      try {
        setLoading(true);
        const res = await fetch("/api/data");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        cache = { data: json, timestamp: Date.now() };
        setData(json);
        setError(null);
      } catch (err: any) {
        console.error("[use-dashboard-data] Fetch error:", err);
        setError(err.message ?? "Failed to load data");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return { data, loading, error };
}
