import Dexie, { type Table } from "dexie";
import type { Practice } from "./types";

class ListenWriteDatabase extends Dexie {
  practices!: Table<Practice, string>;

  constructor() {
    super("listenwrite_english");
    this.version(1).stores({
      practices: "id, updatedAt, lastOpenedAt",
    });
  }
}

export const db = new ListenWriteDatabase();

export async function getPractices(): Promise<Practice[]> {
  return db.practices.orderBy("lastOpenedAt").reverse().toArray();
}

export async function getPractice(id: string): Promise<Practice | undefined> {
  return db.practices.get(id);
}

export async function savePractice(practice: Practice): Promise<void> {
  await db.practices.put({
    ...practice,
    updatedAt: new Date().toISOString(),
  });
}

export async function deletePractice(id: string): Promise<void> {
  await db.practices.delete(id);
}
