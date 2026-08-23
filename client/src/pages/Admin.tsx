import Nav from "../components/Nav";
import UserManager from "../components/UserManager";
import AppSettings from "../components/AppSettings";

export default function Admin() {
  return (
    <div className="min-h-screen">
      <Nav />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-neutral-100">Administration</h1>
        <AppSettings />
        <UserManager />
      </main>
    </div>
  );
}
