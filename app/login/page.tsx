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
          <div className="grid size-11 place-items-center rounded-md bg-stone-950 text-white">
            <Activity aria-hidden size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-stone-950">
              Strategy Tracker
            </h1>
            <p className="text-sm text-stone-500">Private research console</p>
          </div>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
