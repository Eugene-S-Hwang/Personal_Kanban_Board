import { cookies } from "next/headers";
import { KanbanBoard } from "@/app/components/kanban/kanban-board";
import { createClient } from "@/app/utils/supabase/server";

export default async function Home() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    await supabase.auth.signInAnonymously();
  }

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const { data: tasks } =
    currentUser != null
      ? await supabase.from("Tasks").select("*").eq("user_id", currentUser.id)
      : { data: null };

  const { data: tagRows } =
    currentUser != null
      ? await supabase
          .from("tags")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("name", { ascending: true })
      : { data: null };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#08605f] via-[#177e89] to-[#598381]">
      <header className="border-b border-white/10 bg-[#08605f]/40 px-4 py-6 backdrop-blur-md sm:px-8">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#f4f7f2] sm:text-3xl">
              Kanban Board
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/75">
              Organize work visually: create tasks, prioritize, and drag cards
              across stages.
            </p>
          </div>
        </div>
      </header>
      <KanbanBoard tasks={tasks} initialTags={tagRows} />

    </div>
    

  );
}
