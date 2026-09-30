import { WorkspaceNav } from "@/components/workspace/WorkspaceNav";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-16">
      <WorkspaceNav />
      <main className="mx-auto w-full max-w-6xl px-6 pt-8">{children}</main>
    </div>
  );
}
