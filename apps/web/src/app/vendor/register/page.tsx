"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VendorRegisterPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/register?role=vendor");
  }, [router]);

  return <div className="message">Redirecting to registration...</div>;
}
