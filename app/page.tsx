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

  const { data: taskTagLinks } =
    currentUser != null
      ? await supabase
          .from("task_tags")
          .select("task_id, tag_id")
          .eq("user_id", currentUser.id)
      : { data: null };

  const tagNameById = new Map(
    (tagRows ?? []).map((t) => [t.id, t.name] as const),
  );
  const tagIdsByTaskId = new Map<string, string[]>();
  for (const row of taskTagLinks ?? []) {
    const list = tagIdsByTaskId.get(row.task_id) ?? [];
    list.push(row.tag_id);
    tagIdsByTaskId.set(row.task_id, list);
  }

  const tasksWithTags =
    tasks != null
      ? tasks.map((t) => {
          const ids = tagIdsByTaskId.get(t.id) ?? [];
          return {
            ...t,
            tagIds: ids,
            tags: ids
              .map((id) => tagNameById.get(id))
              .filter((n): n is string => n !== undefined),
          };
        })
      : null;

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
      <KanbanBoard tasks={tasksWithTags} initialTags={tagRows} />

    </div>
    

  );
}
