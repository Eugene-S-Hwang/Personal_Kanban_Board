"use client";

import { TagCreateForm, type TagRow } from "./tag-create-form";

type KanbanSidebarProps = {
  initialTags: TagRow[] | null;
  onNewTask: () => void;
};

export function KanbanSidebar({ initialTags, onNewTask }: KanbanSidebarProps) {
  return (
    <aside
      className="flex w-full flex-col gap-5 rounded-2xl border border-white/15 bg-[#08605f]/25 p-4 shadow-lg shadow-black/10 backdrop-blur-sm lg:sticky lg:top-8 lg:max-h-[min(100vh-6rem,calc(100vh-5rem))] lg:w-[150px] lg:shrink-0 lg:overflow-y-auto"
      aria-label="Board actions and tags"
    >
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium uppercase tracking-wide text-[#a2ad59]">
          Tasks
        </p>
        <button
          type="button"
          onClick={onNewTask}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#a2ad59] px-4 py-2.5 text-sm font-semibold text-[#0c2524] shadow-md shadow-black/20 transition hover:brightness-105"
        >
          <span className="text-base leading-none">+</span>
          New task
        </button>
      </div>

      <div className="border-t border-white/10 pt-1">
        <TagCreateForm initialTags={initialTags} />
      </div>
    </aside>
  );
}
