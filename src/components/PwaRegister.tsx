"use client";
import { useEffect } from "react";

// Registers the service worker that makes the dashboard installable.
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/aisha-sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
