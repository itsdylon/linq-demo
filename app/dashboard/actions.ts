"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAirtableStore } from "@/lib/airtable";
import { clearSessionCookie, requireSession } from "@/lib/auth";
import { normalizeDateInput } from "@/lib/utils";

const store = getAirtableStore();

function requiredString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function optionalString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value || undefined;
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

export async function createProjectAction(formData: FormData) {
  await requireSession();

  const project = await store.createProject({
    name: requiredString(formData, "name"),
    clientName: requiredString(formData, "clientName"),
    clientPhone: optionalString(formData, "clientPhone"),
    address: optionalString(formData, "address"),
    budget: formData.get("budget") ? Number(formData.get("budget")) : undefined,
    phase: optionalString(formData, "phase"),
    contextNotes: optionalString(formData, "contextNotes"),
    linqChatIds: optionalString(formData, "linqChatIds")
      ?.split(",")
      .map((chatId) => chatId.trim())
      .filter(Boolean),
  });

  revalidatePath("/dashboard");
  redirect(`/dashboard/projects/${project.recordId}`);
}

export async function updateProjectAction(formData: FormData) {
  await requireSession();

  const projectId = requiredString(formData, "projectId");
  await store.updateProject(projectId, {
    name: requiredString(formData, "name"),
    clientName: requiredString(formData, "clientName"),
    address: optionalString(formData, "address"),
    budget: formData.get("budget") ? Number(formData.get("budget")) : undefined,
    phase: optionalString(formData, "phase"),
    contextNotes: optionalString(formData, "contextNotes"),
    status: optionalString(formData, "status") as never,
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function bindChatToProjectAction(formData: FormData) {
  await requireSession();

  const projectId = requiredString(formData, "projectId");
  const chatId = requiredString(formData, "chatId");
  await store.bindChatToProject(projectId, chatId);

  revalidatePath("/dashboard/unmapped");
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function acceptItemAction(formData: FormData) {
  await requireSession();
  const itemId = requiredString(formData, "itemId");
  const projectId = requiredString(formData, "projectId");
  await store.updateItem(itemId, { status: "Accepted" });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function rejectItemAction(formData: FormData) {
  await requireSession();
  const itemId = requiredString(formData, "itemId");
  const projectId = requiredString(formData, "projectId");
  await store.updateItem(itemId, { status: "Rejected" });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function updateItemAction(formData: FormData) {
  await requireSession();

  const itemId = requiredString(formData, "itemId");
  const projectId = requiredString(formData, "projectId");
  await store.updateItem(itemId, {
    summary: requiredString(formData, "summary"),
    type: requiredString(formData, "type") as never,
    owner: requiredString(formData, "owner") as never,
    due: normalizeDateInput(optionalString(formData, "due")),
    details: optionalString(formData, "details") ?? "",
    status: "Edited",
  });
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function bulkAcceptProjectItemsAction(formData: FormData) {
  await requireSession();
  const projectId = requiredString(formData, "projectId");
  await store.bulkAcceptHighConfidence(projectId);
  revalidatePath(`/dashboard/projects/${projectId}`);
}

export async function generateDigestAction(formData: FormData) {
  await requireSession();
  const projectId = requiredString(formData, "projectId");
  const digestRun = await store.createDigestRun(projectId);
  revalidatePath(`/dashboard/projects/${projectId}`);

  if (!digestRun) {
    redirect(`/dashboard/projects/${projectId}/digest?state=empty`);
  }

  redirect(`/dashboard/projects/${projectId}/digest?run=${digestRun.recordId}`);
}

export async function confirmDigestSyncAction(formData: FormData) {
  await requireSession();
  const digestRunId = requiredString(formData, "digestRunId");
  const projectId = requiredString(formData, "projectId");
  await store.confirmDigestRunSync(digestRunId);
  revalidatePath(`/dashboard/projects/${projectId}`);
  redirect(`/dashboard/projects/${projectId}`);
}
