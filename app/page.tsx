import { LoginForm } from "./login-form";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] font-sans">
      <LoginForm />
    </main>
  );
}
