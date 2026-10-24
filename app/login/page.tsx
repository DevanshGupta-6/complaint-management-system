import { Suspense } from "react";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";

async function login(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (e) {
    if (e instanceof AuthError) redirect("/login?error=1");
    throw e; // signIn success works by throwing a redirect: must propagate
  }
}

// The only part that reads runtime data, so only this part suspends
async function LoginError({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  if (!error) return null;
  return <p className="text-sm text-red-600">Invalid email or password.</p>;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <main className="mx-auto mt-24 max-w-sm space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <Suspense>
        <LoginError searchParams={searchParams} />
      </Suspense>
      <form action={login} className="space-y-3">
        <input name="email" type="email" required autoComplete="email" placeholder="Email"
          className="w-full rounded border px-3 py-2" />
        <input name="password" type="password" required autoComplete="current-password" placeholder="Password"
          className="w-full rounded border px-3 py-2" />
        <button className="w-full rounded bg-black px-3 py-2 text-white">Sign in</button>
      </form>
    </main>
  );
}