import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/site-header";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col px-4 py-6 sm:px-6">
      <Logo />
      <div className="flex flex-1 items-center justify-center py-12">
        <AuthForm mode="login" />
      </div>
    </main>
  );
}
