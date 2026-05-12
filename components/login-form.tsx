"use client";

import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <form
      className="grid gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError("");

        const form = new FormData(event.currentTarget);
        const result = await signIn("credentials", {
          password: String(form.get("password") ?? ""),
          redirect: false,
        });

        setPending(false);

        if (result?.error) {
          setError("That password did not open the vault.");
          return;
        }

        router.push("/runs");
        router.refresh();
      }}
    >
      <input
        autoComplete="current-password"
        className="input"
        name="password"
        placeholder="Password"
        type="password"
      />
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      <button className="primary-button" disabled={pending} type="submit">
        {pending ? "Checking..." : "Enter"}
      </button>
    </form>
  );
}
