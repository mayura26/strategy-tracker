import { Activity } from "lucide-react";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/runs");
  }

  return (
    <main className="app-shell grid min-h-screen place-items-center px-6">
      <div className="panel w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <div className="brand-mark grid size-11 place-items-center rounded-md">
            <Activity aria-hidden size={20} />
          </div>
          <div>
            <h1 className="brand-title text-xl font-bold">Strategy Tracker</h1>
            <p className="quiet-text text-sm">Private research console</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
